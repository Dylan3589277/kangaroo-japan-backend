// 仓库配置响应
export interface WarehouseConfigResponse {
  admin: { realname: string };
  storeNum: number;
  shipNum: number;
  photoNum: number;
  areas: { name: string }[];
  rate: number;
  shipprices: ShipPriceItem[];
}

export interface ShipPriceItem {
  methodCode: string;
  weightLimit: number;
  shipAmount: number;
}

// 如果有可选的属性，用于搜索匹配
export interface WarehouseOrderItem {
  id: string | number;
  orderNo?: string;
  outTradeNo?: string;
  goodsName?: string;
  cover?: string;
  weight?: number;
  postcode?: string;
  status?: number;
  statusTxt?: string;
  shop?: string;
  shopTxt?: string;
  storeTime?: string;
  storeArea?: string;
  extGoodsNo?: string;
  photo?: number;
  remark?: string;
  userRemark?: string;
  nickname?: string;
  mobile?: string;
  ucode?: string;
  realname?: string;
  taobaoid?: string;
  seller?: string;
}

// 订单列表响应
export interface OrderListResponse {
  list: WarehouseOrderItem[];
  totalPages?: number;
  total?: number;
  sellerList?: WarehouseOrderItem[];
}

// 出库单列表项
export interface ShipmentOrderItem {
  id: string;
  remark?: string;
  valueAdded?: string;
  uid?: string;
  outTradeNo?: string;
  realname?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  mobile?: string;
  status: number;
  statusTxt?: string;
  orderJson?: Record<string, any>;
  shipWay?: string;
  shipWayTxt?: string;
  nickname?: string;
  ucode?: string;
  childs?: any[];
  totalWeight?: number;
  totalAmount?: number;
  open?: number;
  shippingNumber?: number;
}

// 出库单详情
export interface ShipmentDetailResponse {
  info: {
    id: string;
    shipWay?: string;
    valueAdded?: string;
    realname?: string;
    status: number;
    mobile?: string;
    address?: string;
    orderIds?: string;
    remark?: string;
    methodName?: string;
    childs?: any[];
    user?: { code?: string; mobile?: string };
  };
  valueAdded?: string;
  packFee?: number;
  rate?: number;
  afterPostFee?: number;
  overTimeFee?: number;
}
