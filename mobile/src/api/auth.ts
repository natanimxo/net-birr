import { api } from "./client";
import { LoginInitResponse, LoginPollResponse, ProfileType, User } from "../types";

export const authApi = {
  initLogin: () => api.post<LoginInitResponse>("/auth/telegram/init", undefined, false),
  pollLogin: (token: string) => api.get<LoginPollResponse>(`/auth/telegram/poll?token=${encodeURIComponent(token)}`, false),
  me: () => api.get<User>("/auth/me"),
  setProfileType: (profile_type: ProfileType) => api.post<User>("/auth/me/profile-type", { profile_type }),
};
