import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { WarehouseService } from './warehouse.service';
import {
  OrdersQueryDto,
  IndexQueryDto,
  InstoreDto,
  CancelstoreDto,
  ShipsQueryDto,
  CheckshipDto,
  ConfirmShipDto,
  DoshipDto,
  AddPhotosDto,
} from './dto/warehouse.dto';

/**
 * 仓库管理控制器
 * 实现入库、出库、打印、拍照等功能
 * 所有接口需要管理员权限
 */
@Controller('api/v1/warehouse')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  // ==================== 入库流程 ====================

  /**
   * POST /api/v1/warehouse/orders
   * 待入库订单列表
   * 对应 PHP: Stores.orders()
   */
  @Post('orders')
  async getOrders(@Body() query: OrdersQueryDto) {
    try {
      const result = await this.warehouseService.getOrders(
        query.kwtype,
        query.kw,
      );
      return { success: true, data: result };
    } catch (e) {
      return {
        success: false,
        error: { code: 'ORDER_ERROR', message: e.message },
      };
    }
  }

  /**
   * POST /api/v1/warehouse/list
   * 库存列表
   * 对应 PHP: Stores.index()
   */
  @Post('list')
  async getIndex(@Body() query: IndexQueryDto) {
    try {
      const result = await this.warehouseService.getIndex(
        query.status,
        query.kw,
        query.uid,
        query.shop,
      );
      return { success: true, data: result };
    } catch (e) {
      return {
        success: false,
        error: { code: 'INDEX_ERROR', message: e.message },
      };
    }
  }

  /**
   * POST /api/v1/warehouse/instore
   * 入库操作
   * 对应 PHP: Stores.instore()
   */
  @Post('instore')
  async instore(@Body() dto: InstoreDto) {
    try {
      const result = await this.warehouseService.instore(
        dto.ids,
        dto.weight,
        dto.area,
        dto.after_post_fee,
      );
      return { success: true, data: result, message: '处理成功' };
    } catch (e) {
      return {
        success: false,
        error: { code: 'INSTORE_ERROR', message: e.message },
      };
    }
  }

  /**
   * POST /api/v1/warehouse/cancelstore
   * 取消入库
   * 对应 PHP: Stores.cancelstore()
   */
  @Post('cancelstore')
  async cancelstore(@Body() dto: CancelstoreDto) {
    try {
      const result = await this.warehouseService.cancelstore(dto.id);
      return { success: true, data: result, message: '处理成功' };
    } catch (e) {
      return {
        success: false,
        error: { code: 'CANCELSTORE_ERROR', message: e.message },
      };
    }
  }

  // ==================== 仓库配置 ====================

  /**
   * GET /api/v1/warehouse/config
   * 仓库配置
   * 对应 PHP: Stores.config()
   */
  @Get('config')
  async getConfig() {
    try {
      const data = await this.warehouseService.getConfig();
      return { success: true, data };
    } catch (e) {
      return {
        success: false,
        error: { code: 'CONFIG_ERROR', message: e.message },
      };
    }
  }

  // ==================== 出库发货流程 ====================

  /**
   * POST /api/v1/warehouse/ships
   * 发货单列表
   * 对应 PHP: Stores.ships()
   */
  @Post('ships')
  async getShips(@Body() query: ShipsQueryDto) {
    try {
      const result = await this.warehouseService.getShips(
        query.status,
        query.kw,
      );
      return { success: true, data: result };
    } catch (e) {
      return {
        success: false,
        error: { code: 'SHIPS_ERROR', message: e.message },
      };
    }
  }

  /**
   * POST /api/v1/warehouse/checkship
   * 审核发货详情
   * 对应 PHP: Stores.checkship()
   */
  @Post('checkship')
  async checkShip(@Body() dto: CheckshipDto) {
    try {
      // 如果传了 uid 参数，则获取用户所有发货单
      if (dto.uid) {
        const result = await this.warehouseService.getAllShip(dto.uid);
        return { success: true, data: result };
      }
      if (!dto.id) {
        return {
          success: false,
          error: { code: 'CHECKSHIP_ERROR', message: '错误的操作' },
        };
      }
      const result = await this.warehouseService.checkShip(dto.id);
      return { success: true, data: result };
    } catch (e) {
      return {
        success: false,
        error: { code: 'CHECKSHIP_ERROR', message: e.message },
      };
    }
  }

  /**
   * POST /api/v1/warehouse/confirm
   * 盘货确认
   * 对应 PHP: Stores.confirm()
   */
  @Post('confirm')
  async confirm(@Body() dto: ConfirmShipDto) {
    try {
      await this.warehouseService.confirm(
        dto.id,
        dto.weight,
        dto.post_fee,
        dto.pack_fee,
        dto.amount,
      );
      return { success: true, message: '处理成功' };
    } catch (e) {
      return {
        success: false,
        error: { code: 'CONFIRM_ERROR', message: e.message },
      };
    }
  }

  /**
   * POST /api/v1/warehouse/doship
   * 执行出库发货
   * 对应 PHP: Stores.doship()
   */
  @Post('doship')
  async doShip(@Body() dto: DoshipDto) {
    try {
      await this.warehouseService.doShip(dto.id, dto.post_code);
      return { success: true, message: '处理成功' };
    } catch (e) {
      return {
        success: false,
        error: { code: 'DOSHIP_ERROR', message: e.message },
      };
    }
  }

  // ==================== 打印模块 ====================

  /**
   * POST /api/v1/warehouse/print-tasks
   * 获取打印任务
   * 对应 PHP: Stores.printTasks()
   */
  @Post('print-tasks')
  async getPrintTasks() {
    try {
      const order = await this.warehouseService.getPrintTasks('admin');
      return { success: true, data: order };
    } catch (e) {
      return {
        success: false,
        error: { code: 'PRINT_ERROR', message: e.message },
      };
    }
  }

  // ==================== 拍照模块 ====================

  /**
   * POST /api/v1/warehouse/photos
   * 拍照订单列表
   * 对应 PHP: Stores.photos()
   */
  @Post('photos')
  async getPhotos(@Body('status') status: number) {
    try {
      const result = await this.warehouseService.getPhotos(status);
      return { success: true, data: result };
    } catch (e) {
      return {
        success: false,
        error: { code: 'PHOTOS_ERROR', message: e.message },
      };
    }
  }

  /**
   * POST /api/v1/warehouse/photos/upload
   * 提交订单照片
   * 对应 PHP: Stores.addPhotos()
   * GET 时获取照片列表，POST 时提交照片
   */
  @Post('photos/upload')
  async uploadPhotos(@Body() dto: AddPhotosDto) {
    try {
      // 如果没有传 pictures 参数，则获取照片列表
      if (!dto.pictures) {
        const list = await this.warehouseService.getOrderPhotos(dto.id);
        return { success: true, data: list };
      }
      await this.warehouseService.addOrderPhotos(dto.id, dto.pictures);
      return { success: true, message: '照片保存成功' };
    } catch (e) {
      return {
        success: false,
        error: { code: 'PHOTO_UPLOAD_ERROR', message: e.message },
      };
    }
  }

  /**
   * GET /api/v1/warehouse/photos/list
   * 获取订单照片列表
   */
  @Get('photos/list')
  async getPhotosList(@Query('id') id: string) {
    try {
      const list = await this.warehouseService.getOrderPhotos(id);
      return { success: true, data: list };
    } catch (e) {
      return {
        success: false,
        error: { code: 'PHOTO_LIST_ERROR', message: e.message },
      };
    }
  }
}
