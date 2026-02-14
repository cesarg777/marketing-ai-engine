import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// --- Languages ---
export const getLanguages = (activeOnly = false) =>
  api.get("/languages/", { params: activeOnly ? { active_only: true } : {} });

export const createLanguage = (data: {
  code: string;
  name: string;
  native_name: string;
  flag_emoji?: string;
}) => api.post("/languages/", data);

export const updateLanguage = (id: number, data: Record<string, unknown>) =>
  api.put(`/languages/${id}`, data);

export const deleteLanguage = (id: number) => api.delete(`/languages/${id}`);

// --- Research ---
export const getResearchWeeks = (limit = 10) =>
  api.get("/research/weeks", { params: { limit } });

export const getResearchWeek = (weekId: number) =>
  api.get(`/research/weeks/${weekId}`);

export const getResearchProblems = (params?: Record<string, string | number>) =>
  api.get("/research/problems", { params });

export const getResearchProblem = (id: number) =>
  api.get(`/research/problems/${id}`);

export const triggerResearch = (data?: {
  niches?: string[];
  countries?: string[];
}) => api.post("/research/trigger", data || {});

// --- Templates ---
export const getTemplates = (activeOnly = false) =>
  api.get("/templates/", { params: activeOnly ? { active_only: true } : {} });

export const getTemplate = (id: number) => api.get(`/templates/${id}`);

export const createTemplate = (data: Record<string, unknown>) =>
  api.post("/templates/", data);

export const updateTemplate = (id: number, data: Record<string, unknown>) =>
  api.put(`/templates/${id}`, data);

export const deleteTemplate = (id: number) => api.delete(`/templates/${id}`);

export const duplicateTemplate = (id: number) =>
  api.post(`/templates/${id}/duplicate`);

// --- Content ---
export const getContentItems = (params?: Record<string, string | number>) =>
  api.get("/content/", { params });

export const getContentItem = (id: number) => api.get(`/content/${id}`);

export const generateContent = (data: {
  problem_id?: number;
  custom_topic?: string;
  template_id: number;
  language: string;
  country?: string;
  tone?: string;
  additional_instructions?: string;
}) => api.post("/content/generate", data);

export const updateContent = (id: number, data: Record<string, unknown>) =>
  api.put(`/content/${id}`, data);

export const deleteContent = (id: number) => api.delete(`/content/${id}`);

export const translateContent = (
  id: number,
  data: { target_language: string; target_country?: string }
) => api.post(`/content/${id}/translate`, data);

export const publishContent = (id: number, channel: string) =>
  api.post(`/content/${id}/publish`, { channel });

export const getContentVersions = (id: number) =>
  api.get(`/content/${id}/versions`);

// --- Amplification ---
export const getAmplificationCandidates = () =>
  api.get("/amplification/candidates");

export const amplifyToBlog = (contentId: number) =>
  api.post("/amplification/blog", null, { params: { content_id: contentId } });

export const createNewsletter = (contentIds: number[]) =>
  api.post("/amplification/newsletter", contentIds);

export const createLandingPage = (contentId: number) =>
  api.post("/amplification/landing-page", null, { params: { content_id: contentId } });

// --- Metrics ---
export const getDashboard = () => api.get("/metrics/dashboard");

export const importMetric = (data: Record<string, unknown>) =>
  api.post("/metrics/import/manual", data);

export const importLinkedInCSV = (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  return api.post("/metrics/import/linkedin", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const getContentMetrics = (contentId: number) =>
  api.get(`/metrics/content/${contentId}`);

export const getWeeklyReports = () => api.get("/metrics/reports");

// --- Videos ---
export const getVideos = (params?: { status?: string; limit?: number }) =>
  api.get("/videos/", { params });

export const getVideo = (id: number) => api.get(`/videos/${id}`);

export const generateVideo = (data: {
  content_item_id: number;
  provider?: string;
  avatar_id?: string;
  language?: string;
}) => api.post("/videos/generate", data);

export const getVideoStatus = (id: number) => api.get(`/videos/${id}/status`);

export const getProviderAvatars = (provider: string) =>
  api.get(`/videos/providers/${provider}/avatars`);

export default api;
