import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { ShipmentOrder } from './entities/shipment-order.entity';
import { OrderPhoto } from './entities/order-photo.entity';
import {
  WarehouseConfigResponse,
  WarehouseOrderItem,
  OrderListResponse,
  ShipmentOrderItem,
  ShipmentDetailResponse,
} from './interfaces/warehouse.interface';

/**
 * 仓库管理服务
 * 实现：入库、出库、盘点、拍照、打印等仓库管理功能
 */
@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(ShipmentOrder)
    private readonly shipmentOrderRepo: Repository<ShipmentOrder>,
    @InjectRepository(OrderPhoto)
    private readonly orderPhotoRepo: Repository<OrderPhoto>,
  ) {}

  // ==================== 入库流程 ====================

  /**
   * 待入库订单列表
   * PHP: orders()
   * 查询 status=2(待入库) && is_pay=1 的订单
   * 支持按 postcode 或 seller 搜索
   */
  async getOrders(kwtype?: string, kw?: string): Promise<OrderListResponse> {
    const where: any = { status: 2, isPay: 1 };
    const sellerWhere: any = { ...where, postcode: '' };

    // 如果有关键词搜索
    if (kwtype && kw && ['seller', 'postcode'].includes(kwtype)) {
      if (kwtype === 'postcode') {
        where.postcode = kw;
        // 先查该快递号的订单
        const orderList = await this.queryOrders(where);
        if (!orderList || orderList.length === 0) {
          throw new BadRequestException('该快递号没有对应的待入库订单');
        }
        // 用第一个订单的 seller 和 shop 查询同一批次的订单
        sellerWhere.seller = orderList[0].seller;
        sellerWhere.shop = orderList[0].shop;
        const sellerList = await this.queryOrders(sellerWhere);
        return { list: orderList, sellerList };
      } else {
        // kwtype === 'seller'
        sellerWhere.seller = kw;
        // 空列表用分批查询
        const orderList: any[] = [];
        const sellerList = await this.queryOrders(sellerWhere);
        return { list: orderList, sellerList };
      }
    }

    const list = await this.queryOrders(where);
    return { list };
  }

  /**
   * 库存列表 (index)
   * 按状态查询订单列表，带分页
   */
  async getIndex(
    status: number = 3,
    kw?: string,
    uid?: number,
    shop?: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<OrderListResponse> {
    const where: any = { status, isPay: 1 };

    const list = await this.queryOrders(where, kw, uid, shop, page, pageSize);
    return { list };
  }

  /**
   * 入库操作
   * PHP: instore()
   * 将多个订单状态从 2(待入库) 改为 3(已入库)
   * 记录重量、库区、入库时间
   */
  async instore(
    ids: string,
    weight: number,
    area?: string,
    afterPostFee?: string,
    adminId?: string,
  ): Promise<{ time: string }> {
    const idArr = ids.split(',').filter(Boolean);
    if (idArr.length === 0) {
      throw new BadRequestException('请选择处理的订单');
    }

    if (weight <= 0) {
      throw new BadRequestException('请输入重量');
    }

    // TODO: 实际项目中从订单表查询
    // const orderList = await this.orderRepo.findBy({ id: In(idArr), status: 2 });
    // if (orderList.length !== idArr.length) {
    //   throw new BadRequestException('选择的订单异常');
    // }

    const avgWeight = Math.round((weight / idArr.length) * 100) / 100;
    const avgAfterFee = afterPostFee
      ? Math.round((parseFloat(afterPostFee) / idArr.length) * 100) / 100
      : 0;

    // TODO: 更新订单状态和重量
    // await this.orderRepo.update(
    //   { id: In(idArr) },
    //   {
    //     status: 3,
    //     weight: avgWeight,
    //     storeTime: Math.floor(Date.now() / 1000),
    //     storeArea: area || '',
    //     afterPostFee: avgAfterFee,
    //     lastUpdateMid: adminId,
    //   },
    // );

    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    return { time: timeStr };
  }

  /**
   * 取消入库
   * PHP: cancelstore()
   * 将已入库订单恢复为待入库状态
   */
  async cancelstore(id: string, adminId?: string): Promise<{ time: string }> {
    if (!id || parseInt(id) <= 0) {
      throw new BadRequestException('请选择处理的订单');
    }

    // TODO: 从订单表查询 status=3 的订单
    // const orderInfo = await this.orderRepo.findOneBy({ id, status: 3 });
    // if (!orderInfo) {
    //   throw new NotFoundException('不存在该入库订单');
    // }

    // TODO: 更新订单状态
    // await this.orderRepo.update(id, {
    //   status: 2,
    //   weight: 0,
    //   storeTime: 0,
    //   storeArea: '',
    //   afterPostFee: 0,
    //   lastUpdateMid: adminId,
    // });

    const now = new Date();
    const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    return { time: timeStr };
  }

  // ==================== 仓库配置 ====================

  /**
   * 仓库配置信息
   * PHP: config()
   * 返回仓库区划、物流价格、在库数量等
   */
  async getConfig(): Promise<WarehouseConfigResponse> {
    // TODO: 从数据库查询
    // const areaList = await this.catsRepo.find({ where: { type: 'store' }, select: ['name'] });
    // const shipPricesList = await this.shipmentPricesRepo.find({ where: { area: 1 }, order: { weightLimit: 'DESC' } });
    // const storeNum = await this.orderRepo.count({ where: { status: 3 } });
    // const shipNum = await this.shipmentOrderRepo.count({ where: { status: 0 } });
    // const photoNum = await this.orderRepo.count({ where: { photo: 1, isPay: 1 } });
    // const configArr = await this.configRepo.getAllArr();
    // const rate = configArr['EXCHANGE_RATE'];

    return {
      admin: { realname: '管理员' },
      storeNum: 0,
      shipNum: 0,
      photoNum: 0,
      areas: [],
      rate: 0.0468,
      shipprices: [],
    };
  }

  // ==================== 出库发货流程 ====================

  /**
   * 发货单列表
   * PHP: ships()
   */
  async getShips(
    status?: number,
    kw?: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ list: ShipmentOrderItem[]; total: number }> {
    const qb = this.shipmentOrderRepo.createQueryBuilder('so');

    if (status !== undefined && status >= 0) {
      qb.andWhere('so.status = :status', { status });
    }

    if (kw) {
      qb.andWhere('u.code = :kw', { kw });
    }

    qb.leftJoin('st_users', 'u', 'u.id = so.uid');
    qb.leftJoin('st_shipments', 's', 's.method_code = so.ship_way');
    qb.orderBy('so.created_at', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawMany();

    // TODO: 格式化数据（解析 order_json, 关联订单等）
    const formattedList = list.map((item) => ({
      id: item.so_id,
      status: item.so_status,
      statusTxt: this.getShipStatusText(item.so_status),
      nickname: item.u_nickname || '',
      ucode: item.u_code || '',
      shipWayTxt: item.s_method_name || '',
      childs: item.so_order_json ? JSON.parse(item.so_order_json) : [],
      totalWeight: 0,
      totalAmount: 0,
      open: 0,
      ...item,
    }));

    return { list: formattedList, total };
  }

  /**
   * 审核发货详情
   * PHP: checkship()
   */
  async checkShip(id: string): Promise<ShipmentDetailResponse> {
    const orderInfo = await this.shipmentOrderRepo.findOneBy({ id });
    if (!orderInfo) {
      throw new NotFoundException('该出库申请不存在');
    }
    if (![0, 1, 2].includes(orderInfo.status)) {
      throw new BadRequestException('该出库申请订单异常');
    }

    // TODO: 查询用户等级信息、订单详情、物流方式、增值服务
    // const userInfo = ...
    // const orderList = ...
    // const valueAddedList = ...

    return {
      info: {
        id: orderInfo.id,
        shipWay: orderInfo.shipWay,
        valueAdded: orderInfo.valueAdded,
        realname: orderInfo.realname,
        status: orderInfo.status,
        mobile: orderInfo.mobile,
        address: orderInfo.address,
        orderIds: orderInfo.orderIds,
        remark: orderInfo.remark,
        childs: [],
        user: { code: '', mobile: '' },
      },
      valueAdded: '',
      packFee: 0,
      rate: 0.0468,
      afterPostFee: orderInfo.afterPostFee,
      overTimeFee: orderInfo.overTimeFee,
    };
  }

  /**
   * 获取用户所有发货单
   * PHP: getallship()
   */
  async getAllShip(uid: string): Promise<any> {
    if (!uid || parseInt(uid) <= 0) {
      throw new BadRequestException('错误的操作');
    }

    // TODO: 查询用户信息和用户的发货单
    // const userInfo = ...
    // const list = await this.shipmentOrderRepo.find({ where: { uid, status: 0 } });

    return {
      info: {
        user: { code: '', mobile: '' },
        childs: [],
      },
      rate: 0,
      afterPostFee: 0,
      overTimeFee: 0,
    };
  }

  /**
   * 盘货确认
   * PHP: confirm()
   */
  async confirm(
    id: string,
    weight: number,
    postFee: number,
    packFee: number,
    amount: number,
    adminId?: string,
  ): Promise<void> {
    if (!id || parseInt(id) <= 0) {
      throw new BadRequestException('请输入完整');
    }

    if (postFee <= 0) {
      throw new BadRequestException('请输入物流费用');
    }

    const orderInfo = await this.shipmentOrderRepo.findOneBy({ id });
    if (!orderInfo) {
      throw new NotFoundException('该出库申请不存在');
    }
    if (![0, 1].includes(orderInfo.status)) {
      throw new BadRequestException('该出库申请订单异常');
    }

    if (amount <= 0) {
      throw new BadRequestException('请输入总费用');
    }

    // TODO: 查询用户等级和汇率计算 amount_rmb
    // const rate = baseRate + userLevel.shipRate;
    // const amountRmb = Math.ceil(amount * rate);

    await this.shipmentOrderRepo.update(id, {
      amount,
      amountRmb: Math.ceil(amount * 0.0468),
      rate: 0.0468,
      status: 1,
      weight,
      postFee,
      packFee,
      lastUpdateMid: adminId,
    });

    // TODO: 发送通知（企业微信、公众号）
  }

  /**
   * 执行出库发货
   * PHP: doship()
   */
  async doShip(id: string, postCode: string, adminId?: string): Promise<void> {
    if (!id || parseInt(id) <= 0 || !postCode) {
      throw new BadRequestException('请输入完整信息');
    }

    const orderInfo = await this.shipmentOrderRepo.findOneBy({ id });
    if (!orderInfo) {
      throw new NotFoundException('该出库申请不存在');
    }

    if (orderInfo.isPay !== 1 || orderInfo.status !== 2) {
      throw new BadRequestException('该出库申请还未支付');
    }

    // TODO: 使用事务更新
    // 1. 更新出库单状态
    await this.shipmentOrderRepo.update(id, {
      postcode: postCode,
      status: 3,
      lastUpdateMid: adminId,
    });

    // 2. 更新关联的订单状态为已发货
    // if (orderInfo.orderIds) {
    //   const orderIdArr = orderInfo.orderIds.split(',');
    //   await this.orderRepo.update(
    //     { id: In(orderIdArr) },
    //     { status: 5, doshipPostTime: Math.floor(Date.now() / 1000), lastUpdateMid: adminId },
    //   );
    // }

    // TODO: 发送通知
  }

  // ==================== 打印模块 ====================

  /**
   * 获取打印任务
   * PHP: printTasks()
   * 从队列中弹出待打印的订单
   */
  async getPrintTasks(adminId: string): Promise<any> {
    // TODO: 从 Redis 队列或数据库获取待打印订单
    // const order = await Printer.popQueue(adminId);
    // if (order) return order;

    throw new NotFoundException('暂时没有打印任务');
  }

  // ==================== 拍照模块 ====================

  /**
   * 拍照订单列表
   * PHP: photos()
   */
  async getPhotos(status: number = 0): Promise<OrderListResponse> {
    const where: any = { isPay: 1 };
    if (status > 0) {
      where.photo = status;
    } else {
      where.photo = { $gt: 0 };
    }

    const list = await this.queryOrders(where);
    return { list };
  }

  /**
   * 获取/提交订单照片
   * PHP: addPhotos()
   * GET: 获取订单照片列表
   * POST: 提交订单照片
   */
  async getOrderPhotos(orderId: string): Promise<string[]> {
    if (!orderId || parseInt(orderId) <= 0) {
      throw new BadRequestException('参数错误');
    }

    const photos = await this.orderPhotoRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    return photos.map((p) => p.uri);
  }

  /**
   * 提交订单照片
   */
  async addOrderPhotos(orderId: string, pictures: string): Promise<void> {
    if (!orderId || parseInt(orderId) <= 0) {
      throw new BadRequestException('参数错误');
    }

    if (!pictures) {
      throw new BadRequestException('图片不能为空');
    }

    const pictureArr = pictures.split(',').filter(Boolean);

    // TODO: 验证订单存在且 photo 标志 >= 1
    // const orderInfo = await this.orderRepo.findOneBy({ id: orderId });
    // if (!orderInfo || orderInfo.photo <= 0) {
    //   throw new BadRequestException('该订单没有选择拍照服务');
    // }

    // TODO: 使用事务
    // 1. 更新订单 photo 状态为 2(已拍照)
    // await this.orderRepo.update(orderId, { photo: 2 });
    // 2. 删除旧照片
    // await this.orderPhotoRepo.delete({ orderId });
    // 3. 插入新照片
    // await this.orderPhotoRepo.save(pictureArr.map(uri => ({ orderId, uri })));
  }

  // ==================== 内部辅助方法 ====================

  /**
   * 查询订单列表（通用方法）
   * TODO: 链接到实际的 orders 表
   */
  private async queryOrders(
    where: any,
    _kw?: string,
    _uid?: number,
    _shop?: string,
    _page?: number,
    _pageSize?: number,
  ): Promise<WarehouseOrderItem[]> {
    // TODO: 从 orders 表查询
    // const qb = this.orderRepo.createQueryBuilder('o')
    //   .leftJoinAndSelect('st_users', 'u', 'u.id = o.uid')
    //   .where(where);
    //
    // if (kw) {
    //   qb.andWhere(new Brackets(qb => {
    //     qb.where('o.trade_no LIKE :kw', { kw: `%${kw}%` })
    //       .orWhere('o.out_trade_no LIKE :kw', { kw: `%${kw}%` })
    //       .orWhere('o.goods_name LIKE :kw', { kw: `%${kw}%` })
    //       .orWhere('o.postcode LIKE :kw', { kw: `%${kw}%` });
    //   }));
    // }
    // if (uid) qb.andWhere('o.uid = :uid', { uid });
    // if (shop) qb.andWhere('o.shop = :shop', { shop });
    //
    // if (page && pageSize) {
    //   qb.skip((page - 1) * pageSize).take(pageSize);
    // }
    //
    // qb.orderBy('o.id', 'DESC');
    // return qb.getMany();

    // 返回空数组作为占位
    return [];
  }

  /**
   * 获取出库单状态文本
   */
  private getShipStatusText(status: number): string {
    const map: Record<number, string> = {
      0: '待审核',
      1: '审核通过',
      2: '已支付',
      3: '已发货',
    };
    return map[status] || '未知';
  }
}
