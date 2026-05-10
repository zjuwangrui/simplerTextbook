"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  ArrowUpRight,
  Clock,
  Compass,
  Layers,
  LineChart,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";

import { Button } from "@pageflux/ui/button";
import { Badge } from "@pageflux/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@pageflux/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@pageflux/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@pageflux/ui/tabs";
import { useTheme } from "@pageflux/shared/contexts/ThemeContext";
import { learningPathService } from "@pageflux/shared/service/learning-paths.service";
import { learningNodeService } from "@pageflux/shared/service/learning-nodes.service";
import { handleApiError } from "@pageflux/shared/lib/api-error-handler";
import { cn, formatDuration } from "@pageflux/shared/utils";
import type { LearningNode, LearningPath, Tag } from "@pageflux/shared/types/openapi";
import {
  deriveLearningNodeState,
  getLearningNodeStatusLabel,
  type GraphNodeData,
  type LearningNodeVariant,
} from "@/lib/learning-node-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@pageflux/ui/select";
import { toast } from "sonner";

interface MyLearningPathsSectionProps {
  refreshToken?: number;
  learningPaths?: LearningPath[];
  loading?: boolean;
}

type FilterValue = "all" | "active" | "completed" | "generating" | "failed";

interface PathMetricItem {
  id: string;
  label: string;
  value: number;
  accent: string;
}

type PathNodeWithMeta = GraphNodeData & {
  progress_status?: string;
  status?: string;
  is_ai_generated?: boolean;
};

const Skeleton = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-700/40",
      className
    )}
  />
);

export default function MyLearningPathsSection({
  refreshToken,
  learningPaths: externalPaths,
  loading: _externalLoading,
}: MyLearningPathsSectionProps) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { isDark } = useTheme();

  const [paths, setPaths] = useState<LearningPath[]>(externalPaths || []);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterValue>("all");
  const [pathTags, setPathTags] = useState<Map<string, Tag[]>>(new Map());
  
  // 当外部传入paths时使用外部数据,并获取tags
  useEffect(() => {
    if (externalPaths && externalPaths.length > 0) {
      setPaths(externalPaths);
      
      // 获取所有path的tags (只在外部paths存在时)
      const fetchTags = async () => {
        const tagsPromises = externalPaths.map(async (path) => {
          if (!path.id) return { pathId: path.id, tags: [] };
          try {
            const tagsResp = await learningPathService.getTags(path.id);
            if (tagsResp.success && tagsResp.data) {
              return { pathId: path.id, tags: tagsResp.data };
            }
          } catch (error) {
            console.warn(`Failed to load tags for path ${path.id}:`, error);
          }
          return { pathId: path.id, tags: [] };
        });

        const tagsResults = await Promise.all(tagsPromises);
        const newPathTags = new Map<string, Tag[]>();
        tagsResults.forEach(({ pathId, tags }) => {
          if (pathId) {
            newPathTags.set(pathId, tags);
          }
        });
        setPathTags(newPathTags);
      };
      
      fetchTags();
    }
  }, [externalPaths]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [selectedNodes, setSelectedNodes] = useState<PathNodeWithMeta[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetNode, setTargetNode] = useState<PathNodeWithMeta | null>(null);
  const [genMode, setGenMode] = useState<"default" | "enhanced">("default");
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<
    | {
        success: boolean;
        lessons: number;
      }
    | null
  >(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingPath, setDeletingPath] = useState<LearningPath | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pathNodesCache = useRef<Map<string, PathNodeWithMeta[]>>(new Map());
  const nodePollingIdsRef = useRef<string[]>([]);
  const nodeCompletionNotifiedRef = useRef<Set<string>>(new Set());
  const nodeFailureNotifiedRef = useRef<Set<string>>(new Set());

  const selectedNodeTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    selectedNodes.forEach((node) => {
      if (node.id) {
        map.set(node.id, node.title ?? node.id);
      }
    });
    return map;
  }, [selectedNodes]);

  const selectedNodeMap = useMemo(() => {
    const map = new Map<string, PathNodeWithMeta>();
    selectedNodes.forEach((node) => {
      if (node.id) {
        map.set(node.id, node);
      }
    });
    return map;
  }, [selectedNodes]);

  const nodeBadgeStyle = useCallback(
    (variant: LearningNodeVariant) => {
      const palette = isDark
        ? {
            completed:
              "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
            generating: "border-amber-500/40 bg-amber-500/15 text-amber-100",
            failed: "border-rose-500/40 bg-rose-500/15 text-rose-100",
            cancelled: "border-slate-500/40 bg-slate-600/20 text-slate-100",
            archived: "border-slate-500/40 bg-slate-700/30 text-slate-200",
            deprecated: "border-slate-500/40 bg-slate-700/30 text-slate-200",
            aiDraft: "border-indigo-500/40 bg-indigo-500/15 text-indigo-100",
            draft: "border-slate-500/40 bg-slate-600/20 text-slate-100",
            inProgress: "border-cyan-500/40 bg-cyan-500/15 text-cyan-100",
            default: "border-cyan-500/40 bg-cyan-500/15 text-cyan-100",
          }
        : {
            completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
            generating: "border-amber-200 bg-amber-50 text-amber-700",
            failed: "border-rose-200 bg-rose-50 text-rose-700",
            cancelled: "border-slate-200 bg-slate-50 text-slate-600",
            archived: "border-slate-200 bg-slate-100 text-slate-600",
            deprecated: "border-slate-200 bg-slate-100 text-slate-600",
            aiDraft: "border-indigo-200 bg-indigo-50 text-indigo-700",
            draft: "border-slate-200 bg-slate-50 text-slate-600",
            inProgress: "border-cyan-200 bg-cyan-50 text-cyan-700",
            default: "border-cyan-200 bg-cyan-50 text-cyan-700",
          };
      return palette[variant] ?? palette.default;
    },
    [isDark]
  );

  const nodeDotStyle = useCallback(
    (variant: LearningNodeVariant) => {
      const palette = isDark
        ? {
            completed: "bg-emerald-400/70 text-black",
            generating: "bg-amber-300/80 text-black",
            failed: "bg-rose-400/80 text-white",
            cancelled: "bg-slate-500/70 text-white",
            archived: "bg-slate-600/70 text-white",
            deprecated: "bg-slate-600/70 text-white",
            aiDraft: "bg-indigo-400/80 text-white",
            draft: "bg-slate-500/70 text-white",
            inProgress: "bg-cyan-300/80 text-black",
            default: "bg-cyan-300/80 text-black",
          }
        : {
            completed: "bg-emerald-400 text-white",
            generating: "bg-amber-400 text-white",
            failed: "bg-rose-400 text-white",
            cancelled: "bg-slate-400 text-white",
            archived: "bg-slate-400 text-white",
            deprecated: "bg-slate-400 text-white",
            aiDraft: "bg-indigo-400 text-white",
            draft: "bg-slate-400 text-white",
            inProgress: "bg-cyan-400 text-white",
            default: "bg-cyan-400 text-white",
          };
      return palette[variant] ?? palette.default;
    },
    [isDark]
  );

  const theme = useMemo(
    () => ({
      surface: isDark
        ? "border-white/10 bg-white/5"
        : "border-slate-200 bg-white shadow-sm",
      title: isDark ? "text-white" : "text-slate-900",
      subtitle: isDark ? "text-white/70" : "text-slate-600",
      chip: isDark
        ? "border-white/15 bg-white/10 text-white/80"
        : "border-slate-200 bg-slate-100 text-slate-600",
      stat: isDark ? "text-white/70" : "text-slate-600",
      statStrong: isDark ? "text-white" : "text-slate-900",
      button: isDark
        ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
    }),
    [isDark]
  );

  const statusStyle = useCallback(
    (status?: string) => {
      const normalized = (status ?? "active").toLowerCase();
      const base = isDark
        ? {
            active: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
            completed: "border-blue-500/40 bg-blue-500/15 text-blue-200",
            generating: "border-amber-500/40 bg-amber-500/15 text-amber-200",
            failed: "border-rose-500/40 bg-rose-500/15 text-rose-200",
            cancelled: "border-rose-500/40 bg-rose-500/15 text-rose-200",
          }
        : {
            active: "border-emerald-200 bg-emerald-100 text-emerald-700",
            completed: "border-blue-200 bg-blue-100 text-blue-700",
            generating: "border-amber-200 bg-amber-100 text-amber-700",
            failed: "border-rose-200 bg-rose-100 text-rose-700",
            cancelled: "border-rose-200 bg-rose-100 text-rose-700",
          };
      return base[normalized as keyof typeof base] ?? base.active;
    },
    [isDark]
  );

  const difficultyStyle = useCallback(
    (difficulty?: string) => {
      const normalized = (difficulty ?? "beginner").toLowerCase();
      const base = isDark
        ? {
            beginner: "border-green-500/40 bg-green-500/15 text-green-200",
            intermediate:
              "border-yellow-500/40 bg-yellow-500/15 text-yellow-200",
            advanced: "border-red-500/40 bg-red-500/15 text-red-200",
          }
        : {
            beginner: "border-green-200 bg-green-100 text-green-700",
            intermediate: "border-yellow-200 bg-yellow-100 text-yellow-700",
            advanced: "border-red-200 bg-red-100 text-red-700",
          };
      return base[normalized as keyof typeof base] ?? base.beginner;
    },
    [isDark]
  );

  const applyNodePatch = useCallback(
    (nodeId: string, patch: Partial<PathNodeWithMeta>) => {
      if (!nodeId) return;
      setSelectedNodes((prev) => {
        const next = prev.map((node) =>
          node.id === nodeId ? ({ ...node, ...patch } as PathNodeWithMeta) : node
        );
        if (selectedPath?.id) {
          pathNodesCache.current.set(selectedPath.id, next);
        }
        return next;
      });
    },
    [selectedPath?.id]
  );

  const generatingNodeIds = useMemo(() => {
    if (!detailOpen) return [] as string[];
    return selectedNodes
      .filter((node) => {
        const status = (node.status ?? "").toLowerCase();
        const progressStatus = (node.progress_status ?? "").toLowerCase();
        return status === "generating" || progressStatus === "generating";
      })
      .map((node) => node.id)
      .filter((id): id is string => Boolean(id));
  }, [detailOpen, selectedNodes]);

  useEffect(() => {
    nodePollingIdsRef.current = generatingNodeIds;
    if (generatingNodeIds.length === 0) {
      nodeCompletionNotifiedRef.current.clear();
      nodeFailureNotifiedRef.current.clear();
      return;
    }
    const idsSet = new Set(generatingNodeIds);
    for (const id of nodeCompletionNotifiedRef.current) {
      if (!idsSet.has(id)) {
        nodeCompletionNotifiedRef.current.delete(id);
      }
    }
    for (const id of nodeFailureNotifiedRef.current) {
      if (!idsSet.has(id)) {
        nodeFailureNotifiedRef.current.delete(id);
      }
    }
  }, [generatingNodeIds]);

  const checkPrerequisites = useCallback(
    (node: PathNodeWithMeta) => {
      const prereqIds = node.prerequisites?.filter(Boolean) ?? [];
      const missing: string[] = [];

      prereqIds.forEach((pid) => {
        const prereq = selectedNodeMap.get(pid);
        const ps = (prereq as any)?.progress_status as string | undefined;
        if (ps && ps !== "completed") {
          missing.push(prereq?.title ?? pid);
        }
      });

      return { met: missing.length === 0, missing };
    },
    [selectedNodeMap]
  );


  const handleNodeInteraction = useCallback(
    (node: PathNodeWithMeta) => {
      const status = (node.status ?? "").toLowerCase();
      const progressStatus = (node.progress_status ?? "").toLowerCase();
      const isAIGenerated = Boolean(node.is_ai_generated);

      if (status === "generating" || progressStatus === "generating") {
        toast.info(t("learn.messages.nodeGenerating"));
        return;
      }

      if (status === "archived" || status === "deprecated") {
        toast.info(t("learn.messages.nodeUnavailableArchivedDeprecated"));
        return;
      }

      if (progressStatus === "failed" || status === "failed") {
        if (isAIGenerated) {
          setTargetNode(node);
          setGenResult(null);
          setGenMode("default");
          setConfirmOpen(true);
        } else {
          toast.info(t("learn.messages.nodeIncomplete"));
        }
        return;
      }

      const prerequisites = checkPrerequisites(node);
      if (!prerequisites.met) {
        toast.error(
          t("learn.messages.prereqIncompleteWithList", {
            list: prerequisites.missing.join(", "),
          })
        );
        return;
      }

      if (isAIGenerated && status === "draft") {
        setTargetNode(node);
        setGenResult(null);
        setGenMode("default");
        setConfirmOpen(true);
        return;
      }

      if (!isAIGenerated && status === "draft") {
        toast.info(t("learn.messages.courseInDev"));
      }
    },
    [checkPrerequisites, t]
  );

  const handleAIGeneration = useCallback(async () => {
    if (!targetNode?.id) return;

    try {
      setGenerating(true);
      setGenResult(null);

      const resp = await learningNodeService.generateCourse(
        targetNode.id,
        genMode
      );

      if (resp.success) {
        toast.success(t("learn.messages.generateRequestSent"));
        setGenResult({ success: true, lessons: 0 });
        applyNodePatch(targetNode.id, {
          status: "generating",
          progress_status: "generating",
        });

        setTimeout(() => {
          setConfirmOpen(false);
          setTargetNode(null);
        }, 1500);
      } else {
        setGenResult({ success: false, lessons: 0 });
        toast.error(t("learn.messages.updateFailed"));
      }
    } catch (error) {
      setGenResult({ success: false, lessons: 0 });
      handleApiError(error, { showToast: true });
    } finally {
      setGenerating(false);
    }
  }, [applyNodePatch, genMode, targetNode, t]);

  const handleRetryFailed = useCallback(
    async (nodeId?: string) => {
      const id = nodeId ?? targetNode?.id;
      if (!id) return;

      try {
        setGenerating(true);
        setGenResult(null);

        const resp = await learningNodeService.retryFailedLessons(id, genMode);

        if (resp.success) {
          toast.success(t("learn.messages.retryRequestSent"));
          setGenResult({ success: true, lessons: 0 });
          applyNodePatch(id, {
            status: "generating",
            progress_status: "generating",
          });

          if (targetNode) {
            setTimeout(() => {
              setConfirmOpen(false);
              setTargetNode(null);
            }, 1500);
          }
        } else {
          setGenResult({ success: false, lessons: 0 });
          toast.error(t("learn.messages.updateFailed"));
        }
      } catch (error) {
        setGenResult({ success: false, lessons: 0 });
        handleApiError(error, { showToast: true });
      } finally {
        setGenerating(false);
      }
    },
    [applyNodePatch, genMode, targetNode, t]
  );

  const refreshPaths = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      try {
        if (!silent) {
          setLoading(true);
        }
        const resp = await learningPathService.listMine({
          page: 1,
          page_size: 20,
        });
        const payload = resp?.data ?? (resp as any)?.data;
        const list: LearningPath[] = payload?.data ?? payload ?? [];
        setPaths(list);

        // 获取所有path的tags
        const tagsPromises = list.map(async (path) => {
          if (!path.id) return { pathId: path.id, tags: [] };
          try {
            const tagsResp = await learningPathService.getTags(path.id);
            if (tagsResp.success && tagsResp.data) {
              return { pathId: path.id, tags: tagsResp.data };
            }
          } catch (error) {
            console.warn(`Failed to load tags for path ${path.id}:`, error);
          }
          return { pathId: path.id, tags: [] };
        });

        const tagsResults = await Promise.all(tagsPromises);
        const newPathTags = new Map<string, Tag[]>();
        tagsResults.forEach(({ pathId, tags }) => {
          if (pathId) {
            newPathTags.set(pathId, tags);
          }
        });
        setPathTags(newPathTags);
      } catch (error) {
        handleApiError(error, {
          showToast: !silent,
          defaultMessage: t("learn.home.myPaths.loadFailed"),
        });
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [t]
  );

  useEffect(() => {
    // 只在没有外部paths时才自己获取数据
    if (!externalPaths || externalPaths.length === 0) {
      refreshPaths();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  useEffect(() => {
    if (generatingNodeIds.length === 0) return;
    let cancelled = false;

    const resolveId = (data: any): string | undefined =>
      data?.id ??
      data?.node_id ??
      data?._id ??
      data?.nodeId ??
      data?.node?.id ??
      data?.node?.node_id ??
      data?.learning_node_id;

    const tick = async () => {
      try {
        const ids = nodePollingIdsRef.current;
        if (ids.length === 0) return;
        const responses = await Promise.all(
          ids.map((id) => learningNodeService.get(id).catch(() => null))
        );
        if (cancelled) return;

        let shouldRefreshPaths = false;

        responses.forEach((resp) => {
          if (!resp?.success || !resp.data) return;
          const data = resp.data as any;
          const resolvedId = resolveId(data);
          if (!resolvedId) return;

          const status = data.status as string | undefined;
          const progressStatus = (data as any)
            ?.progress_status as string | undefined;
          const isAIGenerated = (data as any)
            ?.is_ai_generated as boolean | undefined;

          applyNodePatch(resolvedId, {
            status: status as PathNodeWithMeta["status"],
            progress_status: progressStatus as PathNodeWithMeta["progress_status"],
            is_ai_generated: isAIGenerated,
          });

          const normalizedStatus = (status ?? "").toLowerCase();
          const normalizedProgress = (progressStatus ?? "").toLowerCase();
          const isStillGenerating =
            normalizedStatus === "generating" ||
            normalizedProgress === "generating";

          if (!isStillGenerating) {
            shouldRefreshPaths = true;
            const isFailure =
              normalizedStatus === "failed" ||
              normalizedProgress === "failed";
            if (isFailure) {
              if (!nodeFailureNotifiedRef.current.has(resolvedId)) {
                toast.error(t("learn.messages.pathGenerationFailed"));
                nodeFailureNotifiedRef.current.add(resolvedId);
              }
            } else if (!nodeCompletionNotifiedRef.current.has(resolvedId)) {
              toast.success(t("learn.messages.nodeReady"));
              nodeCompletionNotifiedRef.current.add(resolvedId);
            }
          }
        });

        if (shouldRefreshPaths && !cancelled) {
          await refreshPaths({ silent: true });
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to poll learning node status", error);
        }
      }
    };

    const intervalId = window.setInterval(() => {
      tick().catch(() => undefined);
    }, 7000);

    tick().catch(() => undefined);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyNodePatch, generatingNodeIds, refreshPaths, t]);

  const locale = i18n.language || "zh-CN";

  const formatDate = useCallback(
    (value?: string) => {
      if (!value) {
        return t("learn.home.myPaths.dateUnknown");
      }
      try {
        return new Intl.DateTimeFormat(locale, {
          year: "numeric",
          month: "short",
          day: "numeric",
        }).format(new Date(value));
      } catch {
        return value.slice(0, 16).replace("T", " ");
      }
    },
    [locale, t]
  );

  const formatEstimatedTime = useCallback(
    (estimated?: number) => {
      if (!estimated || estimated <= 0) {
        return t("learn.home.myPaths.estimatedUnknown");
      }
      const seconds = estimated > 1000 ? estimated : estimated * 60;
      return formatDuration(seconds);
    },
    [t]
  );

  const getStatusLabel = useCallback(
    (status?: string) => {
      const normalized = (status ?? "active").toLowerCase();
      switch (normalized) {
        case "generating":
          return t("learn.home.myPaths.status.generating");
        case "completed":
          return t("learn.home.myPaths.status.completed");
        case "failed":
          return t("learn.home.myPaths.status.failed");
        case "cancelled":
          return t("learn.home.myPaths.status.cancelled");
        default:
          return t("learn.home.myPaths.status.active");
      }
    },
    [t]
  );

  const getPathTypeLabel = useCallback(
    (type?: string) => {
      const normalized = (type ?? "personalized").toLowerCase();
      switch (normalized) {
        case "standard":
          return t("learn.home.myPaths.pathType.standard");
        case "custom":
          return t("learn.home.myPaths.pathType.custom");
        case "adaptive":
          return t("learn.home.myPaths.pathType.adaptive");
        default:
          return t("learn.home.myPaths.pathType.personalized");
      }
    },
    [t]
  );

  const metrics: PathMetricItem[] = useMemo(() => {
    const active = paths.filter(
      (p) => (p.progress_status ?? "active") === "active"
    ).length;
    const completed = paths.filter(
      (p) => (p.progress_status ?? "active") === "completed"
    ).length;
    const generating = paths.filter(
      (p) => (p.progress_status ?? "") === "generating"
    ).length;

    const accentBase = isDark
      ? [
          "from-cyan-500/20 via-blue-500/10 to-transparent",
          "from-emerald-500/20 via-teal-500/10 to-transparent",
          "from-amber-500/20 via-orange-500/10 to-transparent",
          "from-blue-500/20 via-indigo-500/10 to-transparent",
        ]
      : [
          "from-cyan-100 via-blue-50 to-transparent",
          "from-emerald-100 via-teal-50 to-transparent",
          "from-amber-100 via-orange-50 to-transparent",
          "from-blue-100 via-indigo-50 to-transparent",
        ];

    return [
      {
        id: "total",
        label: t("learn.home.myPaths.metrics.total"),
        value: paths.length,
        accent: accentBase[0],
      },
      {
        id: "active",
        label: t("learn.home.myPaths.metrics.active"),
        value: active,
        accent: accentBase[1],
      },
      {
        id: "completed",
        label: t("learn.home.myPaths.metrics.completed"),
        value: completed,
        accent: accentBase[3],
      },
      {
        id: "generating",
        label: t("learn.home.myPaths.metrics.generating"),
        value: generating,
        accent: accentBase[2],
      },
    ];
  }, [isDark, paths, t]);

  const filteredPaths = useMemo(() => {
    if (activeFilter === "all") {
      // "全部" tab 中过滤掉已取消的路径
      return paths.filter((path) => {
        const status = (path.progress_status ?? "active").toLowerCase();
        return status !== "cancelled" && status !== "failed";
      });
    }
    return paths.filter((path) => {
      const status = (path.progress_status ?? "active").toLowerCase();
      if (activeFilter === "failed") {
        return status === "failed" || status === "cancelled";
      }
      return status === activeFilter;
    });
  }, [activeFilter, paths]);

  const sortedPaths = useMemo(() => {
    return [...filteredPaths].sort((a, b) => {
      const left = new Date(a.updated_at ?? a.created_at ?? 0).getTime();
      const right = new Date(b.updated_at ?? b.created_at ?? 0).getTime();
      return right - left;
    });
  }, [filteredPaths]);

  const openDetail = useCallback(
    async (path: LearningPath) => {
      if (!path?.id) return;
      setSelectedPath(path);
      setDetailOpen(true);

      const cached = pathNodesCache.current.get(path.id);
      if (cached) {
        setSelectedNodes(cached);
        return;
      }

      setDetailLoading(true);
      try {
        const resp = await learningPathService.get(path.id);
        const payload = resp?.data ?? (resp as any)?.data;
        const nodes: LearningNode[] = payload?.nodes ?? [];
        
        // 直接使用API返回的节点数据，包含prerequisites字段
        const mapped: PathNodeWithMeta[] = nodes.map(
          (node, idx) => ({
            id: node.id ?? `${idx}`,
            title: node.title,
            description: node.description,
            prerequisites: (node as any).prerequisites ?? [],
            progress_status: (node as any)?.progress_status,
            ...((node as any)?.status ? { status: (node as any)?.status } : {}),
            ...(typeof (node as any)?.is_ai_generated === "boolean"
              ? { is_ai_generated: (node as any)?.is_ai_generated }
              : {}),
          })
        );
        pathNodesCache.current.set(path.id, mapped);
        setSelectedNodes(mapped);

        // 使用已缓存的tags,避免重复请求
        const cachedTags = pathTags.get(path.id) || [];
        setSelectedTags(cachedTags);
      } catch (error) {
        handleApiError(error, {
          showToast: true,
          defaultMessage: t("learn.home.myPaths.detailLoadFailed"),
        });
        setSelectedNodes([]);
      } finally {
        setDetailLoading(false);
      }
    },
    [pathTags, t]
  );

  const closeDetail = useCallback(
    (open: boolean) => {
      setDetailOpen(open);
      if (!open) {
        if (selectedPath?.id) {
          const cached = pathNodesCache.current.get(selectedPath.id);
          const source = cached ?? selectedNodes;
          const hasGenerating = source?.some((node) => {
            const status = (node.status ?? "").toLowerCase();
            const progressStatus = (node.progress_status ?? "").toLowerCase();
            return status === "generating" || progressStatus === "generating";
          });
          if (hasGenerating) {
            pathNodesCache.current.delete(selectedPath.id);
          }
        }
        setSelectedPath(null);
        setSelectedNodes([]);
        setSelectedTags([]);
      }
    },
    [selectedNodes, selectedPath?.id]
  );

  // 删除学习路径
  const handleDeletePath = useCallback(async () => {
    if (!deletingPath?.id) return;
    setDeleting(true);
    try {
      const resp = await fetch("/api/v1/user/master-path/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path_id: deletingPath.id }),
      });
      if (resp.ok) {
        toast.success("删除成功");
        setDeleteConfirmOpen(false);
        setDeletingPath(null);
        await refreshPaths();
      } else {
        const data = await resp.json().catch(() => ({}));
        toast.error(data?.message || "删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  }, [deletingPath, refreshPaths]);

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 transition-colors",
        theme.surface,
        "flex h-full flex-col gap-6"
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h2 className={cn("text-xl font-semibold", theme.title)}>
            {t("learn.home.myPaths.title")}
          </h2>
          <p className={cn("text-sm", theme.subtitle)}>
            {t("learn.home.myPaths.subtitle", { count: paths.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2", theme.button)}
            onClick={() => refreshPaths()}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-4 w-4", loading ? "animate-spin" : undefined)}
            />
            {t("learn.home.myPaths.actions.refresh")}
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => router.push("/paths")}
          >
            {t("learn.home.myPaths.actions.viewAll")}
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            className={cn(
              "relative overflow-hidden rounded-xl border p-4",
              isDark
                ? "border-white/15 bg-white/5"
                : "border-slate-200 bg-white"
            )}
          >
            <div
              className={cn(
                "pointer-events-none absolute inset-0 bg-gradient-to-br",
                metric.accent
              )}
            />
            <div className="relative flex flex-col gap-1">
              <span className={cn("text-xs uppercase", theme.subtitle)}>
                {metric.label}
              </span>
              <span className="text-2xl font-semibold text-cyan-500 dark:text-cyan-300">
                {metric.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Tabs
        value={activeFilter}
        onValueChange={(val) => setActiveFilter(val as FilterValue)}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <TabsList
            className={cn(
              "w-full justify-start overflow-x-auto md:w-auto",
              isDark ? "bg-white/10" : "bg-slate-100"
            )}
          >
            {(
              [
                { id: "all", label: t("learn.home.myPaths.filters.all") },
                { id: "active", label: t("learn.home.myPaths.filters.active") },
                {
                  id: "generating",
                  label: t("learn.home.myPaths.filters.generating"),
                },
                {
                  id: "completed",
                  label: t("learn.home.myPaths.filters.completed"),
                },
                { id: "failed", label: t("learn.home.myPaths.filters.failed") },
              ] as const
            ).map((filter) => (
              <TabsTrigger key={filter.id} value={filter.id} className="px-4">
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className={cn("text-sm", theme.subtitle)}>
            {t("learn.home.myPaths.filterCount", { count: sortedPaths.length })}
          </div>
        </div>

        <TabsContent value={activeFilter} className="mt-0">
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Card
                  key={idx}
                  className={cn(
                    "overflow-hidden border",
                    isDark
                      ? "border-white/10 bg-white/5"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <CardHeader className="space-y-4">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-10 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : sortedPaths.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-10 text-center">
              <div className="text-4xl">🚀</div>
              <div className="space-y-2">
                <p className={cn("text-lg font-semibold", theme.title)}>
                  {t("learn.home.myPaths.empty.title")}
                </p>
                <p className={cn("text-sm", theme.subtitle)}>
                  {t("learn.home.myPaths.empty.description")}
                </p>
              </div>
              <Button className="gap-1" onClick={() => router.push("/paths")}>
                {t("learn.home.myPaths.empty.cta")}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sortedPaths.map((path) => (
                <Card
                  key={path.id ?? path.title}
                  className={cn(
                    "group flex h-full flex-col overflow-hidden border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg relative",
                    isDark
                      ? "border-white/10 bg-white/5 hover:bg-white/10"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  )}
                >
                  {/* 删除按钮 - 绝对定位到右上角 */}
                  <button
                    className={cn(
                      "absolute top-1 right-1 z-10 p-1 rounded hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-500 dark:text-rose-300",
                      "transition-colors"
                    )}
                    title="删除学习路径"
                    onClick={() => {
                      setDeletingPath(path);
                      setDeleteConfirmOpen(true);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <CardHeader className="flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <CardTitle
                          className={cn(
                            "text-lg font-semibold leading-tight",
                            theme.title
                          )}
                        >
                          {path.title ?? t("learn.home.myPaths.untitled")}
                        </CardTitle>
                        <CardDescription
                          className={cn(
                            "line-clamp-2 text-sm leading-relaxed",
                            theme.subtitle
                          )}
                        >
                          {path.description ??
                            t("learn.home.myPaths.noDescription")}
                        </CardDescription>
                      </div>
                      <Badge
                        className={cn(
                          "shrink-0 border px-2 py-1 text-xs font-medium",
                          statusStyle(path.progress_status)
                        )}
                      >
                        {getStatusLabel(path.progress_status)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {path.path_type && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "border px-2 py-1 text-xs uppercase tracking-wide",
                            theme.chip
                          )}
                        >
                          {getPathTypeLabel(path.path_type)}
                        </Badge>
                      )}
                      {path.difficulty && (
                        <Badge
                          variant="outline"
                          className={cn(
                            "border px-2 py-1 text-xs uppercase tracking-wide",
                            difficultyStyle(path.difficulty)
                          )}
                        >
                          {t(`courses.filters.level.${path.difficulty}`)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div
                        className={cn("flex items-center gap-2", theme.stat)}
                      >
                        <Clock className="h-4 w-4" />
                        <span>
                          {t("learn.home.myPaths.estimatedTime", {
                            value: formatEstimatedTime(path.estimated_times),
                          })}
                        </span>
                      </div>
                      <div
                        className={cn("flex items-center gap-2", theme.stat)}
                      >
                        <LineChart className="h-4 w-4" />
                        <span>
                          {t("learn.home.myPaths.updatedAt", {
                            value: formatDate(
                              path.updated_at ?? path.created_at
                            ),
                          })}
                        </span>
                      </div>
                      <div
                        className={cn("flex items-center gap-2", theme.stat)}
                      >
                        <Compass className="h-4 w-4" />
                        <span>
                          {(() => {
                            const tags = path.id ? pathTags.get(path.id) || [] : [];
                            if (tags.length > 0) {
                              const displayTags = tags.slice(0, 2).map(tag => tag.name).join(', ');
                              return displayTags;
                            }
                            return path.goal_category
                              ? t("learn.home.myPaths.goalCategory", {
                                  value: path.goal_category,
                                })
                              : t("learn.home.myPaths.goalFallback");
                          })()}
                        </span>
                      </div>
                      {path.goal && (
                        <div
                          className={cn("flex items-center gap-2", theme.stat)}
                        >
                          <Layers className="h-4 w-4" />
                          <span className="line-clamp-1">{path.goal}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn("gap-1", theme.button)}
                        onClick={() => openDetail(path)}
                      >
                        {t("learn.home.myPaths.actions.openDetail")}
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1"
                        onClick={() => router.push(`/paths/${path.id}`)}
                      >
                        {t("learn.home.myPaths.actions.openFull")}
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={detailOpen} onOpenChange={closeDetail}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {selectedPath?.title ??
                t("learn.home.myPaths.detail.dialogTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("learn.home.myPaths.detail.dialogSubtitle")}
            </DialogDescription>
          </DialogHeader>

          {selectedPath && (
            <div className="space-y-4">
              <div
                className={cn(
                  "rounded-xl border p-4",
                  isDark
                    ? "border-white/10 bg-white/5"
                    : "border-slate-200 bg-slate-50"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "border px-2 py-1 text-xs font-medium",
                      statusStyle(selectedPath.progress_status)
                    )}
                  >
                    {getStatusLabel(selectedPath.progress_status)}
                  </Badge>
                  {selectedPath.path_type && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "border px-2 py-1 text-xs uppercase tracking-wide",
                        theme.chip
                      )}
                    >
                      {getPathTypeLabel(selectedPath.path_type)}
                    </Badge>
                  )}
                  {selectedPath.difficulty && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "border px-2 py-1 text-xs uppercase tracking-wide",
                        difficultyStyle(selectedPath.difficulty)
                      )}
                    >
                      {t(`courses.filters.level.${selectedPath.difficulty}`)}
                    </Badge>
                  )}
                </div>
                {selectedTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="text-xs"
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                )}
                {selectedPath.description && (
                  <p
                    className={cn(
                      "mt-3 text-sm leading-relaxed",
                      theme.subtitle
                    )}
                  >
                    {selectedPath.description}
                  </p>
                )}
              </div>

              <div
                className={cn(
                  "relative min-h-[420px] overflow-hidden rounded-xl border",
                  isDark
                    ? "border-white/10 bg-[#0B1220]/80"
                    : "border-slate-200 bg-white"
                )}
              >
                {detailLoading ? (
                  <div className="flex h-[420px] items-center justify-center">
                    <div className="inline-flex items-center gap-3 text-sm">
                      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-cyan-500" />
                      <span>{t("learn.home.myPaths.detail.loading")}</span>
                    </div>
                  </div>
                ) : selectedNodes.length === 0 ? (
                  <div className="flex h-[420px] items-center justify-center text-sm">
                    <span className={theme.subtitle}>
                      {t("learn.home.myPaths.detail.noNodes")}
                    </span>
                  </div>
                ) : (
                  <div className="flex h-[420px] flex-col">
                    <div className="flex items-center justify-between gap-2 px-6 pt-5">
                      <h4
                        className={cn(
                          "text-sm font-semibold uppercase tracking-wide",
                          theme.title
                        )}
                      >
                        {t("learn.home.myPaths.detail.timelineTitle")}
                      </h4>
                      <span className={cn("text-xs", theme.subtitle)}>
                        {t("learn.home.myPaths.detail.totalNodes", {
                          count: selectedNodes.length,
                        })}
                      </span>
                    </div>
                    <div className="relative flex-1 overflow-hidden">
                      <div className="pointer-events-none absolute left-10 top-0 bottom-0 w-px bg-slate-200/70 dark:bg-white/10" />
                      <div className="h-full overflow-y-auto px-4 pb-6 pr-6">
                        <div className="space-y-6 pt-4">
                          {selectedNodes.map((node, idx) => {
                            const stateMeta = deriveLearningNodeState({
                              status: (node as any)?.status,
                              progressStatus: node.progress_status,
                              isAIGenerated: (node as any)?.is_ai_generated,
                            });
                            const statusLabel = getLearningNodeStatusLabel(
                              t,
                              stateMeta
                            );
                            const prereqIds = (node.prerequisites || []).filter(
                              Boolean
                            );
                            const prereqTitles = prereqIds.map(
                              (pid) => selectedNodeTitleMap.get(pid) ?? pid
                            );
                            const showMorePrereqs = prereqTitles.length > 3;
                            const isAIGenerated = Boolean(
                              (node as any)?.is_ai_generated
                            );
                            const normalizedStatus = (
                              ((node as any)?.status as string | undefined)?.toLowerCase?.() ??
                              ""
                            );
                            const normalizedProgressStatus = (
                              node.progress_status ?? ""
                            ).toLowerCase();
                            const isInteractive =
                              isAIGenerated &&
                              (normalizedStatus === "draft" ||
                                normalizedStatus === "failed" ||
                                normalizedProgressStatus === "failed");

                            return (
                              <div
                                key={node.id ?? `${idx}`}
                                className="relative pl-16"
                              >
                                {idx < selectedNodes.length - 1 && (
                                  <span
                                    className="pointer-events-none absolute left-[29px] top-14 h-full w-px bg-slate-200/70 dark:bg-white/10"
                                    aria-hidden
                                  />
                                )}
                                <span className="absolute left-2 top-6 flex h-12 w-12 items-center justify-center">
                                  <span
                                    className={cn(
                                      "flex h-12 w-12 items-center justify-center rounded-full border text-xs font-semibold shadow-lg backdrop-blur-sm",
                                      nodeBadgeStyle(stateMeta.variant)
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold",
                                        nodeDotStyle(stateMeta.variant)
                                      )}
                                    >
                                      {idx + 1}
                                    </span>
                                  </span>
                                </span>
                                <div
                                  className={cn(
                                    "rounded-xl border p-4 transition-colors",
                                    isDark
                                      ? "border-white/10 bg-white/5 hover:border-cyan-400/40"
                                      : "border-slate-200 bg-white hover:border-cyan-200/80"
                                    ,
                                    isInteractive
                                      ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                                      : undefined
                                  )}
                                  role={isInteractive ? "button" : undefined}
                                  tabIndex={isInteractive ? 0 : undefined}
                                  onClick={() => handleNodeInteraction(node)}
                                  onKeyDown={(event) => {
                                    if (
                                      !isInteractive
                                    ) {
                                      return;
                                    }
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      handleNodeInteraction(node);
                                    }
                                  }}
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1 pr-4">
                                      <h5
                                        className={cn(
                                          "text-sm font-semibold leading-snug",
                                          theme.title
                                        )}
                                      >
                                        {node.title ||
                                          t("learn.home.myPaths.untitled")}
                                      </h5>
                                      {node.description && (
                                        <p
                                          className={cn(
                                            "text-xs leading-relaxed",
                                            theme.subtitle
                                          )}
                                        >
                                          {node.description}
                                        </p>
                                      )}
                                    </div>
                                    <Badge
                                      className={cn(
                                        "border px-2 py-1 text-[11px] font-medium uppercase tracking-wide",
                                        nodeBadgeStyle(stateMeta.variant)
                                      )}
                                    >
                                      {statusLabel}
                                    </Badge>
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                                    <span
                                      className={cn(
                                        "inline-flex items-center gap-1 rounded-full border px-2 py-1",
                                        theme.chip
                                      )}
                                    >
                                      <Layers className="h-3 w-3" />
                                      {prereqTitles.length > 0
                                        ? t(
                                            "learn.home.myPaths.detail.prereqCount",
                                            {
                                              count: prereqTitles.length,
                                            }
                                          )
                                        : t(
                                            "learn.home.myPaths.detail.noPrerequisites"
                                          )}
                                    </span>
                                    {prereqTitles.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1">
                                        {prereqTitles
                                          .slice(0, 3)
                                          .map((title) => (
                                            <span
                                              key={`${node.id}-${title}`}
                                              className={cn(
                                                "rounded-full border px-2 py-0.5",
                                                theme.chip
                                              )}
                                            >
                                              {title}
                                            </span>
                                          ))}
                                        {showMorePrereqs && (
                                          <span
                                            className={cn(
                                              "rounded-full border px-2 py-0.5",
                                              theme.chip
                                            )}
                                          >
                                            +{prereqTitles.length - 3}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {isAIGenerated && (
                                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-500/10 px-2 py-1 text-[11px] text-purple-400">
                                        ✨{" "}
                                        {t(
                                          "learn.home.myPaths.detail.aiGenerated"
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  className={cn(theme.button)}
                  onClick={() => router.push(`/paths/${selectedPath.id}`)}
                >
                  {t("learn.home.myPaths.actions.openFull")}
                  <ArrowUpRight className="ml-1 h-4 w-4" />
                </Button>
                <Button onClick={() => closeDetail(false)}>
                  {t("learn.home.myPaths.actions.closeDetail")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmOpen(false);
            setGenerating(false);
            setGenResult(null);
            setTargetNode(null);
          }
        }}
      >
        <DialogContent
          className={cn(
            "max-w-md",
            isDark
              ? "bg-[#0F1420] text-white border-white/10"
              : "bg-white text-slate-900"
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span role="img" aria-hidden>
                🧠
              </span>
              {targetNode?.progress_status === "failed" ||
              targetNode?.status === "failed"
                ? "重试生成课程"
                : "AI 生成课程"}
            </DialogTitle>
            <DialogDescription>
              {targetNode?.progress_status === "failed" ||
              targetNode?.status === "failed"
                ? `即将重试生成「${targetNode?.title ?? ""}」的课程内容`
                : `即将为「${targetNode?.title ?? ""}」生成个性化课程内容`}
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              "py-3 text-sm",
              isDark ? "text-white/70" : "text-slate-600"
            )}
          >
            该操作可能耗时 2-3 分钟。
          </div>
          <div className="py-3">
            <label
              className={cn(
                "text-sm font-medium mb-2 block",
                isDark ? "text-white" : "text-slate-900"
              )}
            >
              生成模式
            </label>
            <Select
              value={genMode}
              onValueChange={(value: string) =>
                setGenMode((value as "default" | "enhanced") ?? "default")
              }
            >
              <SelectTrigger
                className={cn(
                  "w-full",
                  isDark
                    ? "bg-white/5 border-white/10 text-white"
                    : "bg-white border-slate-200 text-slate-900"
                )}
              >
                <SelectValue placeholder="选择模式" />
              </SelectTrigger>
              <SelectContent
                className={cn(
                  isDark
                    ? "bg-[#0F1420] text-white border-white/10"
                    : "bg-white text-slate-900 border-slate-200"
                )}
              >
                <SelectItem value="default">标准模式</SelectItem>
                <SelectItem value="enhanced">增强模式 (更高质量)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {genResult && (
            <div
              className={cn(
                "mt-3 rounded-md border p-4 text-sm",
                isDark
                  ? "border-white/10 bg-white/5 text-white/80"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              )}
            >
              <div
                className={cn(
                  "font-medium",
                  isDark ? "text-emerald-400" : "text-emerald-600"
                )}
              >
                {targetNode?.progress_status === "failed" ||
                targetNode?.status === "failed"
          ? t("learn.messages.retryRequestSent")
          : t("learn.messages.generateRequestSent")}
              </div>
            </div>
          )}
          <DialogFooter>
            {!genResult ? (
              <Button
                disabled={generating}
                onClick={
                  targetNode?.progress_status === "failed" ||
                  targetNode?.status === "failed"
                    ? () => handleRetryFailed(targetNode?.id)
                    : handleAIGeneration
                }
                className="w-full h-12"
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    生成中...
                  </span>
                ) : targetNode?.progress_status === "failed" ||
                  targetNode?.status === "failed" ? (
                  "重试生成"
                ) : (
                  "一键生成"
                )}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmOpen(false);
                    setGenerating(false);
                    setGenResult(null);
                    setTargetNode(null);
                  }}
                >
                  关闭
                </Button>
                {targetNode?.id && (
                  <Button onClick={() => router.push(`/courses/${targetNode.id}`)}>
                    前往课程
                  </Button>
                )}
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认删除学习路径</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-sm">
            确认要删除学习路径「{deletingPath?.title ?? ""}」吗？此操作不可恢复。
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeletePath}
              disabled={deleting}
            >
              {deleting ? "删除中..." : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



