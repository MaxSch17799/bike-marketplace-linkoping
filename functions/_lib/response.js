export function jsonResponse(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function ok(data = {}) {
  return jsonResponse(200, { ok: true, ...data });
}

export function fail(status, error) {
  return jsonResponse(status, { ok: false, error });
}
