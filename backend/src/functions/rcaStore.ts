import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  getRCA,
  saveRCA,
  listRCAVersions,
  getRCAVersion,
  isStorageConfigured,
} from '../services/storageService.js';

/**
 * 저장된 RCA 최신본 조회 — 새로고침 후에도 보고서가 유지되도록 한다.
 * GET /api/rca/{ticketId}/document
 */
app.http('getRCADocument', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'rca/{ticketId}/document',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const ticketId = request.params.ticketId;
    if (!ticketId) {
      return { status: 400, jsonBody: { success: false, error: 'ticketId is required' } };
    }
    const stored = await getRCA(ticketId);
    if (!stored) {
      return {
        status: 404,
        jsonBody: { success: false, error: 'No saved RCA found', storageConfigured: isStorageConfigured() },
      };
    }
    return { status: 200, jsonBody: { success: true, data: stored } };
  },
});

/**
 * 사용자가 검토/수정한 RCA 저장 — 새 버전이 생성된다.
 * PUT /api/rca/{ticketId}/document
 */
app.http('saveRCADocument', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'rca/{ticketId}/document',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const ticketId = request.params.ticketId;
    if (!ticketId) {
      return { status: 400, jsonBody: { success: false, error: 'ticketId is required' } };
    }
    if (!isStorageConfigured()) {
      return { status: 503, jsonBody: { success: false, error: 'Storage is not configured' } };
    }
    try {
      const body = (await request.json()) as { rca?: unknown };
      if (!body.rca) {
        return { status: 400, jsonBody: { success: false, error: 'rca is required' } };
      }
      const stored = await saveRCA(ticketId, body.rca, 'user-edit');
      return { status: 200, jsonBody: { success: true, data: stored } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save RCA';
      return { status: 500, jsonBody: { success: false, error: message } };
    }
  },
});

/**
 * RCA 버전 이력 조회 (Blob versioning 기반).
 * GET /api/rca/{ticketId}/versions
 */
app.http('listRCAVersionsFn', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'rca/{ticketId}/versions',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const ticketId = request.params.ticketId;
    if (!ticketId) {
      return { status: 400, jsonBody: { success: false, error: 'ticketId is required' } };
    }
    const versions = await listRCAVersions(ticketId);
    return { status: 200, jsonBody: { success: true, data: versions } };
  },
});

/**
 * 특정 RCA 버전 스냅샷 내용 조회.
 * GET /api/rca/{ticketId}/versions/{versionId}
 */
app.http('getRCAVersionFn', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'rca/{ticketId}/versions/{versionId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const { ticketId, versionId } = request.params;
    if (!ticketId || !versionId) {
      return { status: 400, jsonBody: { success: false, error: 'ticketId and versionId are required' } };
    }
    const rca = await getRCAVersion(ticketId, decodeURIComponent(versionId));
    if (!rca) {
      return { status: 404, jsonBody: { success: false, error: 'Version not found' } };
    }
    return { status: 200, jsonBody: { success: true, data: { ticketId, versionId, rca } } };
  },
});
