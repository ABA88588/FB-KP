# 组件清单

## Shell

- `AppShell`
- `SidebarNav`
- `WorkspaceSwitcher`
- `TopContextBar`
- `AdAccountPicker`
- `DateRangePicker`
- `DataFreshnessBadge`
- `DemoModeBanner`

## 通用

- `PageHeader`
- `MetricCard`
- `StatusBadge`
- `EffectiveStatusBadge`
- `PermissionGuard`
- `WriteGateTooltip`
- `EmptyState`
- `InlineError`
- `StaleDataNotice`
- `LoadingRows`
- `ConfirmActionDialog`
- `PartialResultDialog`
- `RequestIdCopy`

## 广告管理

- `EntityLevelTabs`
- `AdsDataTable`
- `EntityNameCell`
- `StatusToggleCell`
- `MoneyCell`
- `MetricCell`
- `FilterBuilder`
- `ActiveFilterChips`
- `SavedViewMenu`
- `ColumnManager`
- `BulkActionBar`
- `EntityInspectorDrawer`
- `EntitySummaryTab`
- `EntitySettingsTab`
- `EntityTrendTab`
- `EntityActivityTab`

## 创建向导

- `CreateAdsWizard`
- `WizardStepper`
- `DraftSaveIndicator`
- `CampaignStep`
- `AdSetStep`
- `CreativeStep`
- `ReviewStep`
- `BudgetEditor`
- `ScheduleEditor`
- `TargetingSummary`
- `PlacementEditor`
- `CreativeAssetPicker`
- `CopyEditor`
- `AdPreviewPanel`
- `PublishReadinessPanel`
- `PublishResultPanel`

## 报表

- `ReportQueryBuilder`
- `MetricSelector`
- `BreakdownSelector`
- `BreakdownCompatibilityMessage`
- `QuerySizeEstimate`
- `AsyncReportProgress`
- `ReportChart`
- `ReportTable`
- `ReportPresetMenu`
- `ExportStatus`

## 运维与设置

- `SyncJobTable`
- `SyncJobProgress`
- `MetaErrorCard`
- `ConnectionHealthCard`
- `ScopeList`
- `TokenExpiryNotice`
- `AuditLogTable`
- `MemberRoleEditor`

## 必须支持的组件状态

每个异步数据组件：

```text
idle
loading
refreshing
success
empty
filtered-empty
stale
partial
permission-denied
connection-expired
recoverable-error
fatal-error
```

每个 mutation 组件：

```text
ready
confirming
queued
processing
success
partial-success
unknown-outcome
failed
```

## Story/Test fixture

为下列状态提供可直接访问的开发 fixture 或 Story：

- 无账户。
- 演示账户。
- Token 7 天后到期。
- Token 已失效。
- 同步延迟 2 小时。
- Campaign 空表。
- 筛选后空表。
- 批量操作部分失败。
- 创建发布 unknown outcome。
- 报表 rate limited。
