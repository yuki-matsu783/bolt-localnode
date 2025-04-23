// このAPIはlocalhost:5174のコンテンツをプロキシするためのものです
import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/cloudflare';

// すべてのHTTPメソッドをハンドル
export async function action({ request }: ActionFunctionArgs) {
  return handleProxyRequest(request);
}

export async function loader({ request }: LoaderFunctionArgs) {
  return handleProxyRequest(request);
}

async function handleProxyRequest(request: Request) {
  try {
    const url = new URL(request.url);
    const targetPath = url.searchParams.get('path') || '';
    
    // 目標URLを構築
    const targetURL = `http://localhost:5174${targetPath}`;
    
    console.log(`[Proxy] Forwarding request to: ${targetURL}`);
    
    // リクエストを転送
    const headers = new Headers(request.headers);
    headers.set('Origin', 'http://localhost:5173');
    headers.set('Host', 'localhost:5174');
    
    const proxyRequest = new Request(targetURL, {
      method: request.method,
      headers: headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'follow',
    });
    
    const response = await fetch(proxyRequest);
    
    // レスポンスのヘッダーをコピー
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    // キャッシュを無効化
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    responseHeaders.set('Pragma', 'no-cache');
    responseHeaders.set('Expires', '0');
    
    // プリフライトリクエストに対応
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: responseHeaders,
      });
    }
    
    // レスポンスボディをコピー
    const responseBody = await response.arrayBuffer();
    
    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('[Proxy] Error:', error);
    return json({ error: 'Proxy request failed' }, { status: 500 });
  }
}