/**
 * تایپ‌های مشترک چت — استفاده‌شده در assistant/page.tsx و کامپوننت‌های استخراج‌شده.
 */

import type { DeviceAsset } from "@/lib/device-assets";

export type Source = {
  title: string;
  file_name: string;
  category: string;
  score: number;
};

export type ResourceLink = {
  title: string;
  url: string;
  source?: string;
  score?: number;
};

export type ResourceImage = {
  title: string;
  url: string;
  page_url?: string;
  source?: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  detected_domain?: string;
  question_id?: number;
  relatedDevices?: DeviceAsset[];
  resource_links?: ResourceLink[];
  resource_images?: ResourceImage[];
  attachment?: {
    name: string;
    kind: "file" | "image";
    analysisType?: string;
    note?: string;
    status?: "uploaded" | "analyzing" | "done" | "error";
    previewUrl?: string;
  };
};

export type Customer = {
  id: number;
  full_name: string;
  email: string;
  company?: string;
  phone?: string;
};

export type SavedChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    sources?: Source[];
    detected_domain?: string;
    question_id?: number;
    relatedDevices?: DeviceAsset[];
    resource_links?: ResourceLink[];
    resource_images?: ResourceImage[];
    attachment?: ChatMessage["attachment"];
    file_name?: string;
    file_url?: string;
    file_type?: string;
    test_type?: string;
    test_type_label?: string;
    image_type?: string;
    image_type_label?: string;
  };
  created_at: string;
};

export type ToolAction =
  | "upload"
  | "troubleshooting"
  | "device-suggestion"
  | "catalyst-suggestion"
  | "customer-request";
