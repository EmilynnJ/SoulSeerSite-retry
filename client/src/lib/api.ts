import axios from "axios";

const apiInstance = axios.create({
  baseURL: "/", // same origin
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiInstance;