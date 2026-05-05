export const getToken = () => localStorage.getItem("auth_token");
export const setToken = (token: string) => localStorage.setItem("auth_token", token);
export const removeToken = () => localStorage.removeItem("auth_token");

export const getUser = () => {
  const user = localStorage.getItem("auth_user");
  return user ? JSON.parse(user) : null;
};
export const setUser = (user: any) => localStorage.setItem("auth_user", JSON.stringify(user));
export const removeUser = () => localStorage.removeItem("auth_user");

const headers = () => ({
  "Content-Type": "application/json",
  "Authorization": `Bearer ${getToken()}`
});

export const api = {
  get: async (url: string) => {
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  post: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  put: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  delete: async (url: string) => {
    const res = await fetch(url, {
      method: "DELETE",
      headers: headers(),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
}
