export const api = {
  async get<T>(url: string): Promise<T> {
    return request<T>(url, { method: "GET" });
  },

  async post<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  },

  async upload<T>(url: string, body: FormData): Promise<T> {
    return request<T>(url, {
      method: "POST",
      body
    });
  }
};

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error?.message ?? `请求失败: ${response.status}`;
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export function buildFormData(fileList: FileList) {
  const formData = new FormData();
  Array.from(fileList).forEach((file) => formData.append("files", file));
  return formData;
}
