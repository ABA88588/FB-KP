import type { DataState } from "@adflow/shared";

export type PageKey = "overview" | "campaigns" | "campaigns-new" | "creatives" | "reports" | "sync-center" | "settings";

export type ToastKind = "info" | "success" | "warning" | "danger";

export type ToastMessage = {
  text: string;
  kind: ToastKind;
};

export type ShellContext = {
  page: PageKey;
  dataState: DataState;
  showToast: (text: string, kind?: ToastKind) => void;
};
