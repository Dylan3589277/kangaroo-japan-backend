import { Controller, Get, Post, Body, Query, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiResponse, OverviewDto, ModuleDataDto, Alert, ResolveAlertDto } from './dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  async getOverview(): Promise<ApiResponse<OverviewDto>> {
    const data = await this.dashboardService.getOverview();
    return { success: true, data };
  }

  @Get('module/:module')
  async getModuleData(@Param('module') module: string): Promise<ApiResponse<ModuleDataDto | null>> {
    const data = await this.dashboardService.getModuleData(module);
    return { success: true, data };
  }

  @Get('alerts')
  async getAlerts(
    @Query('status') status?: string,
    @Query('module') module?: string,
    @Query('dateRange') dateRange?: string,
  ): Promise<ApiResponse<{ alerts: Alert[] }>> {
    const filters: { status?: string; module?: string; dateRange?: string } = {};
    if (status) filters.status = status;
    if (module) filters.module = module;
    if (dateRange) filters.dateRange = dateRange;
    const alerts = await this.dashboardService.getAlerts(filters);
    return { success: true, data: { alerts } };
  }

  @Post('alerts/resolve')
  async resolveAlert(@Body() body: ResolveAlertDto): Promise<ApiResponse<{ id: string }>> {
    await this.dashboardService.resolveAlert(body.alertId, body.result, body.handler);
    return { success: true, data: { id: body.alertId } };
  }
}
