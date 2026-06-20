/**
 * StorageService — Azure Table Storage + Blob 영구 저장 계층.
 *
 * - Table `Tickets`: 이메일(메일 스레드) 내용을 구조화하여 저장
 * - Table `RcaDocuments`: 생성/수정된 RCA 보고서의 최신 상태 저장
 * - Blob 컨테이너 `rca-versions`: RCA 스냅샷을 저장하며, 스토리지 계정의
 *   Blob 버전 관리(versioning)가 켜져 있어 매 저장마다 자동으로 버전이 보존됨
 *
 * 연결 문자열(AzureWebJobsStorage)이 없으면 모든 메서드는 graceful no-op으로
 * 동작하여 로컬/샘플 환경에서도 앱이 정상 기동되도록 한다.
 */
import { TableClient, odata } from '@azure/data-tables';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

const TICKETS_TABLE = 'Tickets';
const RCA_TABLE = 'RcaDocuments';
const RCA_CONTAINER = 'rca-versions';

function getConnectionString(): string | null {
  return process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage || null;
}

export function isStorageConfigured(): boolean {
  return getConnectionString() !== null;
}

let ticketsClient: TableClient | null = null;
let rcaClient: TableClient | null = null;
let containerClient: ContainerClient | null = null;
let initialized = false;

async function ensureInit(): Promise<boolean> {
  const conn = getConnectionString();
  if (!conn) return false;
  if (initialized) return true;

  ticketsClient = TableClient.fromConnectionString(conn, TICKETS_TABLE);
  rcaClient = TableClient.fromConnectionString(conn, RCA_TABLE);

  const blobService = BlobServiceClient.fromConnectionString(conn);
  containerClient = blobService.getContainerClient(RCA_CONTAINER);

  // 테이블/컨테이너가 없으면 생성 (이미 있으면 무시)
  await Promise.all([
    ticketsClient.createTable().catch(() => undefined),
    rcaClient.createTable().catch(() => undefined),
    containerClient.createIfNotExists().catch(() => undefined),
  ]);

  initialized = true;
  return true;
}

export interface StoredTicket {
  ticketId: string;
  subject: string;
  vendor: string;
  status?: string;
  messages: unknown[];
  participants?: string[];
  metadata?: unknown;
}

/**
 * 메일 스레드(이메일 내용)를 Table Storage에 저장.
 */
export async function saveTicket(ticket: StoredTicket): Promise<void> {
  if (!(await ensureInit()) || !ticketsClient) return;

  await ticketsClient.upsertEntity(
    {
      partitionKey: 'ticket',
      rowKey: ticket.ticketId,
      subject: ticket.subject,
      vendor: ticket.vendor,
      status: ticket.status ?? '',
      messageCount: Array.isArray(ticket.messages) ? ticket.messages.length : 0,
      // Table Storage는 기본형만 저장하므로 복합 데이터는 JSON 문자열로 보관
      payload: JSON.stringify(ticket),
      updatedAt: new Date().toISOString(),
    },
    'Replace',
  );
}

export async function getTicket(ticketId: string): Promise<StoredTicket | null> {
  if (!(await ensureInit()) || !ticketsClient) return null;
  try {
    const entity = await ticketsClient.getEntity('ticket', ticketId);
    return JSON.parse(entity.payload as string) as StoredTicket;
  } catch {
    return null;
  }
}

export interface StoredRCA {
  ticketId: string;
  rca: unknown;
  version: number;
  source: string;
  updatedAt: string;
}

/**
 * RCA 보고서를 저장. Table에는 최신본을, Blob에는 버전 스냅샷을 남긴다.
 * 스토리지 계정의 Blob 버전 관리가 켜져 있으면 같은 blob에 덮어써도
 * 이전 버전이 자동으로 보존되어 RCA 편집 이력을 추적할 수 있다.
 */
export async function saveRCA(
  ticketId: string,
  rca: unknown,
  source = 'azure-openai',
): Promise<StoredRCA | null> {
  if (!(await ensureInit()) || !rcaClient || !containerClient) return null;

  // 현재 버전 조회 후 증가
  let version: number;
  try {
    const existing = await rcaClient.getEntity('rca', ticketId);
    version = ((existing.version as number) ?? 0) + 1;
  } catch {
    version = 1;
  }

  const updatedAt = new Date().toISOString();
  const payload = JSON.stringify(rca);

  // 1) Table: 최신본 upsert
  await rcaClient.upsertEntity(
    {
      partitionKey: 'rca',
      rowKey: ticketId,
      version,
      source,
      payload,
      updatedAt,
    },
    'Replace',
  );

  // 2) Blob: 버전 스냅샷 (versioning 활성 시 자동 보존)
  const blob = containerClient.getBlockBlobClient(`${ticketId}.json`);
  await blob.upload(payload, Buffer.byteLength(payload), {
    blobHTTPHeaders: { blobContentType: 'application/json' },
    metadata: { ticketid: ticketId, version: String(version), updatedat: updatedAt },
  });

  return { ticketId, rca, version, source, updatedAt };
}

export async function getRCA(ticketId: string): Promise<StoredRCA | null> {
  if (!(await ensureInit()) || !rcaClient) return null;
  try {
    const entity = await rcaClient.getEntity('rca', ticketId);
    return {
      ticketId,
      rca: JSON.parse(entity.payload as string),
      version: (entity.version as number) ?? 1,
      source: (entity.source as string) ?? '',
      updatedAt: (entity.updatedAt as string) ?? '',
    };
  } catch {
    return null;
  }
}

export interface RCAVersionInfo {
  versionId: string;
  isCurrent: boolean;
  createdOn: string;
  version: string;
}

/**
 * Blob 버전 관리로 보존된 RCA 스냅샷 이력을 조회.
 */
export async function listRCAVersions(ticketId: string): Promise<RCAVersionInfo[]> {
  if (!(await ensureInit()) || !containerClient) return [];
  const versions: RCAVersionInfo[] = [];
  try {
    for await (const blob of containerClient.listBlobsFlat({
      prefix: `${ticketId}.json`,
      includeVersions: true,
      includeMetadata: true,
    })) {
      if (blob.name !== `${ticketId}.json`) continue;
      versions.push({
        versionId: blob.versionId ?? '',
        isCurrent: blob.isCurrentVersion ?? false,
        createdOn: blob.properties.createdOn?.toISOString() ?? '',
        version: (blob.metadata?.version as string) ?? '',
      });
    }
  } catch {
    return [];
  }
  return versions.sort((a, b) => b.createdOn.localeCompare(a.createdOn));
}

/**
 * 특정 RCA 버전 스냅샷의 내용을 조회.
 */
export async function getRCAVersion(ticketId: string, versionId: string): Promise<unknown | null> {
  if (!(await ensureInit()) || !containerClient) return null;
  try {
    const blob = containerClient.getBlockBlobClient(`${ticketId}.json`).withVersion(versionId);
    const buffer = await blob.downloadToBuffer();
    return JSON.parse(buffer.toString('utf-8'));
  } catch {
    return null;
  }
}

export { odata };
