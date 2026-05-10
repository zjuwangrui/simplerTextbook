import { GraphStatus, TextbookStatus } from "./types";

export function readError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return "未知错误";
}

export function formatFileSize(bytes: number) {
  if (!bytes) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function statusLabel(status: TextbookStatus) {
  if (status === "ready") {
    return "已完成";
  }
  if (status === "failed") {
    return "失败";
  }
  return "解析中";
}

export function graphStatusLabel(status: GraphStatus) {
  if (status === "ready") {
    return "图谱已完成";
  }
  if (status === "building") {
    return "图谱生成中";
  }
  if (status === "failed") {
    return "图谱失败";
  }
  return "未生成图谱";
}
