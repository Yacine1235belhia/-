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

const handleResponse = async (res: Response) => {
  if (res.status === 401) {
    removeToken();
    removeUser();
    window.location.reload();
  }
  
  if (!res.ok) {
    const text = await res.text();
    let errorMessage = "Request failed";
    try {
      const json = JSON.parse(text);
      if (json.error) errorMessage = json.error;
    } catch (e) {
      if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
  }
  
  return res.json();
};

export const api = {
  get: async (url: string) => {
    const res = await fetch(url, { headers: headers() });
    return handleResponse(res);
  },
  post: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  put: async (url: string, data: any) => {
    const res = await fetch(url, {
      method: "PUT",
      headers: headers(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  delete: async (url: string) => {
    const res = await fetch(url, {
      method: "DELETE",
      headers: headers(),
    });
    return handleResponse(res);
  }
}
