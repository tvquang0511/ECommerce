import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, CalendarRange, TrendingUp, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts";

import { boardsApi } from "../../../api/boards.api";
import { analyticsApi } from "../../../api/analytics.api";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "../../../components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";

const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

const formatDuration = (seconds: number | null) => {
  if (seconds === null) return "-";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
};

const formatDayLabel = (value: string) => {
  try {
    return format(parseISO(value), "dd/MM");
  } catch {
    return value;
  }
};

const formatFullDayLabel = (value: string) => {
  try {
    return format(parseISO(value), "dd/MM/yyyy");
  } catch {
    return value;
  }
};

export const BoardAnalyticsPage: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "1y">("30d");

  const { data: board } = useQuery({
    queryKey: ["board", boardId],
    queryFn: () => boardsApi.getById(boardId!),
    enabled: !!boardId,
  });

  const analyticsQuery = useQuery({
    queryKey: ["board", boardId, "analytics", range],
    queryFn: () => analyticsApi.getBoardAnalytics(boardId!, { range }),
    enabled: !!boardId,
  });

  const daily = analyticsQuery.data?.daily ?? [];

  const chartData = useMemo(() => {
    return daily.map((d) => ({
      date: d.date,
      label: formatDayLabel(d.date),
      created: d.cardsCreatedCount,
      done: d.cardsDoneCount,
      wip: d.wipCount,
      overdue: d.overdueCount,
    }));
  }, [daily]);

  const pieData = useMemo(() => {
    const summary = analyticsQuery.data?.summary;
    return [
      { key: "created", value: summary?.cardsCreatedCount ?? 0, fill: "var(--color-created)" },
      { key: "done", value: summary?.cardsDoneCount ?? 0, fill: "var(--color-done)" },
    ];
  }, [analyticsQuery.data?.summary]);

  if (analyticsQuery.isError) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Button variant="ghost" onClick={() => navigate(`/boards/${boardId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Quay lại bảng
        </Button>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          Bạn không có quyền xem thống kê hoặc dữ liệu chưa sẵn sàng.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-emerald-50">
      <div className="container mx-auto max-w-6xl py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button variant="ghost" onClick={() => navigate(`/boards/${boardId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Quay lại bảng
            </Button>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <BarChart3 className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Thống kê bảng</div>
                <div className="text-2xl font-semibold text-slate-900">
                  {board?.name ?? "Bảng"}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarRange className="h-4 w-4" />
              Khoảng thời gian
            </div>
            <Select value={range} onValueChange={(value) => setRange(value as any)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Chọn" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 ngày</SelectItem>
                <SelectItem value="30d">30 ngày</SelectItem>
                <SelectItem value="90d">90 ngày</SelectItem>
                <SelectItem value="1y">1 năm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {analyticsQuery.isLoading ? (
          <div className="mt-10 rounded-xl border bg-white p-6 text-sm text-muted-foreground">
            Đang tải thống kê...
          </div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Hoàn thành</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-3xl font-semibold text-slate-900">
                        {formatNumber(analyticsQuery.data?.summary.cardsDoneCount ?? 0)}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">Tổng số thẻ hoàn thành</div>
                    </div>
                    <ChartContainer
                      className="aspect-square h-20 w-20"
                      config={{
                        created: { label: "Tạo mới", color: "var(--chart-1)" },
                        done: { label: "Hoàn thành", color: "var(--chart-2)" },
                      }}
                    >
                      <PieChart>
                        <ChartTooltip
                          content={<ChartTooltipContent nameKey="key" />}
                        />
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="key"
                          innerRadius={18}
                          outerRadius={30}
                          strokeWidth={0}
                        >
                          {pieData.map((entry) => (
                            <Cell key={entry.key} fill={entry.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Đang làm</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-slate-900">
                    {formatNumber(analyticsQuery.data?.summary.latestWipCount ?? 0)}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">WIP hiện tại</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Thời gian chu kỳ</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-slate-900">
                    {formatDuration(analyticsQuery.data?.summary.avgCycleTimeSec ?? null)}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Trung bình từ Doing → Done</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Quá hạn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold text-rose-600">
                    {formatNumber(analyticsQuery.data?.summary.latestOverdueCount ?? 0)}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Thẻ quá hạn</div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card className="border-emerald-100">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Năng suất</CardTitle>
                    <div className="text-xs text-muted-foreground">Thẻ hoàn thành theo ngày</div>
                  </div>
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  {daily.length ? (
                    <ChartContainer
                      className="aspect-auto h-56 w-full"
                      config={{
                        done: { label: "Hoàn thành", color: "var(--chart-2)" },
                      }}
                    >
                      <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(_label: unknown, tooltipPayload: any) => {
                                const raw = (tooltipPayload?.[0] as any)?.payload?.date as string | undefined;
                                return raw ? formatFullDayLabel(raw) : "";
                              }}
                            />
                          }
                        />
                        <Bar dataKey="done" fill="var(--color-done)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-sm text-muted-foreground">Chưa có dữ liệu</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-sky-100">
                <CardHeader className="flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Tạo mới vs Hoàn thành</CardTitle>
                    <div className="text-xs text-muted-foreground">Số thẻ tạo mới và hoàn thành</div>
                  </div>
                  <Users className="h-4 w-4 text-sky-500" />
                </CardHeader>
                <CardContent>
                  {daily.length ? (
                    <ChartContainer
                      className="aspect-auto h-56 w-full"
                      config={{
                        created: { label: "Tạo mới", color: "var(--chart-1)" },
                        done: { label: "Hoàn thành", color: "var(--chart-2)" },
                      }}
                    >
                      <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(_label: unknown, tooltipPayload: any) => {
                                const raw = (tooltipPayload?.[0] as any)?.payload?.date as string | undefined;
                                return raw ? formatFullDayLabel(raw) : "";
                              }}
                            />
                          }
                        />
                        <ChartLegend
                          content={({ payload, verticalAlign }) => (
                            <ChartLegendContent payload={payload} verticalAlign={verticalAlign} />
                          )}
                        />
                        <Bar dataKey="created" fill="var(--color-created)" radius={4} />
                        <Bar dataKey="done" fill="var(--color-done)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-sm text-muted-foreground">Chưa có dữ liệu</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-amber-100">
                <CardHeader>
                  <CardTitle className="text-base">WIP theo ngày</CardTitle>
                  <div className="text-xs text-muted-foreground">Số thẻ đang làm</div>
                </CardHeader>
                <CardContent>
                  {daily.length ? (
                    <ChartContainer
                      className="aspect-auto h-56 w-full"
                      config={{
                        wip: { label: "WIP", color: "var(--chart-4)" },
                      }}
                    >
                      <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(_label: unknown, tooltipPayload: any) => {
                                const raw = (tooltipPayload?.[0] as any)?.payload?.date as string | undefined;
                                return raw ? formatFullDayLabel(raw) : "";
                              }}
                            />
                          }
                        />
                        <Bar dataKey="wip" fill="var(--color-wip)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-sm text-muted-foreground">Chưa có dữ liệu</div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-rose-100">
                <CardHeader>
                  <CardTitle className="text-base">Quá hạn theo ngày</CardTitle>
                  <div className="text-xs text-muted-foreground">Thẻ quá hạn</div>
                </CardHeader>
                <CardContent>
                  {daily.length ? (
                    <ChartContainer
                      className="aspect-auto h-56 w-full"
                      config={{
                        overdue: { label: "Quá hạn", color: "var(--chart-5)" },
                      }}
                    >
                      <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={20} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              labelFormatter={(_label: unknown, tooltipPayload: any) => {
                                const raw = (tooltipPayload?.[0] as any)?.payload?.date as string | undefined;
                                return raw ? formatFullDayLabel(raw) : "";
                              }}
                            />
                          }
                        />
                        <Bar dataKey="overdue" fill="var(--color-overdue)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="text-sm text-muted-foreground">Chưa có dữ liệu</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">Hoạt động theo khoảng thời gian</CardTitle>
                <div className="text-xs text-muted-foreground">Tổng hợp các tương tác trên bảng</div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg bg-slate-50 p-4">
                    <div className="text-xs text-muted-foreground">Comments</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {formatNumber(analyticsQuery.data?.summary.commentsCount ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <div className="text-xs text-muted-foreground">Attachments</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {formatNumber(analyticsQuery.data?.summary.attachmentsCount ?? 0)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-4">
                    <div className="text-xs text-muted-foreground">Assignees</div>
                    <div className="mt-1 text-2xl font-semibold">
                      {formatNumber(
                        (analyticsQuery.data?.summary.assigneesAddedCount ?? 0) -
                          (analyticsQuery.data?.summary.assigneesRemovedCount ?? 0),
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};
