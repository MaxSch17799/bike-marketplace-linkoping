export async function readJson(request) {
  try {
    const data = await request.json();
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: "Invalid JSON body." };
  }
}

export async function readForm(request) {
  try {
    const data = await request.formData();
    return { ok: true, value: data };
  } catch (error) {
    return { ok: false, error: "Invalid form data." };
  }
}
