<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 14:57
 * description:
 */

namespace app\api\controller;

use app\common\library\Kuaidi100;
use app\common\library\Mericari;
use app\common\model\OrderModel;
use app\common\model\ShipOrders;
use think\App;
use think\facade\Db;
use Tools\StRedis;

class Orders extends Base
{
    public function __construct(App $app)
    {
        $this->noNeedLogin = ['autobuy'];
        parent::__construct($app);
    }

    public function services(){
        $type = input('type','ship');
        $type = in_array($type,['order','ship'])?$type:'ship';
        $valueList = Db::name('value_added')->where('type',$type)->select()->toArray();
        foreach ($valueList as &$item) {
            $item['checked'] = false;
        }
        return $this->jsuccess('ok',$valueList);
    }

    public function confirm()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $id = input('id', '');
        if (empty($id)) {
            return $this->jerror('错误的请求');
        }
        $shop = input('shop','mercari');
        if(!in_array($shop,['mercari','amazon','yahoo'])){
            return $this->jerror('参数错误');
        }
        $key = sprintf('%s_%s',$shop,$id);
        $redis = new StRedis();
        $json = $redis->get($key);
        if (empty($json)) {
            return $this->jerror('操作错误');
        }
        $data = is_array($json) ? $json : json_decode($json, true);
        if($shop == 'yahoo'){
            if(!isset($data['fastprice']) || $data['fastprice'] <=0){
                return $this->jerror('参数错误');
            }
            $data['price'] = $data['fastprice'];
        }
        if($data['price'] <=0){
            return $this->jerror('商品异常');
        }

        $rate = \think\facade\Config::get('config.EXCHANGE_RATE');
        $userInfo = Db::name('users')
            ->alias('u')
            ->where('u.id', $this->uid)
            ->field('u.*,l.name as level_name,l.fee as level_fee,l.rate as level_rate')
            ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
            ->find();
        $rate = floatval($rate) + floatval($userInfo['level_rate']);
        //-- 获取商城
        $shopInfo = Db::name('shops')
            ->where('is_deleted', 0)
            ->where('code', $shop)
            ->field('code,name,fee')
            ->find();

        $data['fee'] = $shopInfo['fee'] + $userInfo['level_fee'];
        $data['amount'] = $data['price'] + $data['fee'];
        $data['rate'] = round($rate, 4);
        $data['amount_rmb'] = ceil($data['amount'] * $rate);
        $articleInfo = Db::name('articles')->field('content')->where('id', 13)->find();
        $data['tips'] = $articleInfo['content'];
        return $this->jsuccess('ok', $data);
    }

    /**
     * 提交订单
     */
    public function submit()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }

        $this->requestLimit();

        //-- 查看是否还有未支付的订单，由管理员创建的
        $count = Db::name('orders')
            ->where('uid', $this->uid)
            ->where('status', 0)
            ->where('is_pay', 0)
            ->count();
        if (intval($count) > 0) {
            return $this->jerror('你还有订单未支付');
        }

        $shop = input('shop','mercari');
        if(!in_array($shop,['mercari','amazon','yahoo'])){
            return $this->jerror('参数错误');
        }
        //附加服务
        $values = input('values','');

        $itemno = input('id', '');
        if (empty($itemno)) {
            return $this->jerror('错误的请求');
        }

        if($shop == 'mercari' || $shop == 'yahoo'){
            //-- 判断该商品是否被下单
            $res = Db::name('orders')
                ->where('shop', 'in',['mercari','yahoo'])
                ->where('ext_goods_no', $itemno)
                ->whereNotIn('status', [-1, 6, 7])
                ->count();
            if (intval($res) > 0) {
                return $this->jerror('你下手晚了');
            }
        }

        $key = sprintf('%s_%s', $shop,$itemno);
        $redis = new StRedis();
        $json = $redis->get($key);
        if (empty($json)) {
            return $this->jerror('操作错误');
        }
        $data = is_array($json) ? $json : json_decode($json, true);
        if($shop == 'yahoo'){
            if(!isset($data['fastprice']) || $data['fastprice'] <=0){
                return $this->jerror('参数错误');
            }
            $data['price'] = $data['fastprice'];
        }

        if($shop == 'mercari'){
            if(isset($data['is_offerable_v2']) && $data['is_offerable_v2']){
                return $this->jerror('该商品为竞拍商品，请联系客服进行下单');
            }
        }

        if($data['price'] <=0){
            return $this->jerror('商品异常');
        }

        //附加服务
        $valueList = Db::name('value_added')->where('type', 'order')->select()->toArray();
        $valueItemArr = array_column($valueList, null, 'id');

        $value_added_fee = 0;
        $value_added = [];
        $value_added_names = [];
        //处理附加服务
        if (!empty($values)) {
            $valIds = explode(',', $values);
            foreach ($valIds as $valId) {
                if (!isset($valueItemArr[$valId])) {
                    return $this->jerror('附加服务选择错误');
                }
                $value_added_fee += $valueItemArr[$valId]['price'];
                $value_added[] = $valueItemArr[$valId]['id'];
                $value_added_names[] = $valueItemArr[$valId]['name'];
            }
        }
        $params = [
            'uid' => $this->uid,
            'goods_name' => $data['goods_name'],
            'cover' => oss_url($data['cover']),
            'price' => $data['price'],
            'shop' => $shop,
            'cat' => 1293,
            'ext_goods_no' => $itemno,
            'seller' => $data['seller'],
            'seller_id' => $data['seller_id']??0,
            'seller_address' => $data['seller_address'],
            'quantity' => 1,
            'is_pay' => 0,
            'value_added_fee' => $value_added_fee,
            'value_added' => implode(',', $value_added),
            'value_added_names' => implode(',', $value_added_names)
        ];

        //-- 获取商城手续费和等级手续费
        $levelInfo = Db::name('user_levels')
            ->where('id', $this->userInfo['level'])
            ->find();
        $shopInfo = Db::name('shops')
            ->where('code', $shop)
            ->find();
        $params['fee'] = $shopInfo['fee'];
        $params['level_fee'] = $levelInfo['fee'];
        $params['amount'] = $params['price'] + $params['fee'] + $params['level_fee']+$params['value_added_fee'];
        if(isset($params['remark'])){
            $params['user_remark'] = $params['remark'];
            unset($params['remark']);
        }

        $params['photo_fee'] = 0;

        list($errcode, $result) = (new OrderModel())->addRow($params);
        if ($errcode !== 0) {
            return $this->jerror($result);
        }

        return $this->jsuccess('下单成功', ['ids' => $result]);
    }

    /**
     * 订单详情
     */
    public function detail()
    {
        $id = input('id', '');
        if (intval($id) <= 0) {
            $this->jerror('错误的请求');
        }
        try {
            $info = Db::name('orders')
                ->where('uid', $this->uid)
                ->where('id', intval($id))
                ->field('id,out_trade_no,goods_name,shop,value_added_fee,value_added_names,status,quantity,user_remark,refund_remark,store_picture,create_mid as amid,cover,price,ext_goods_no,seller,seller_address,fee,after_post_fee,post_fee,level_fee,amount,amount_rmb,create_time')
                ->find();
            if (!$info) {
                return $this->jerror('该订单不存在');
            }
            $info['remark'] = empty($info['user_remark']) ? '' : $info['user_remark'];
            $itemList = [
                ['label' => '订单编号', 'value' => $info['out_trade_no']],
                ['label' => '下单时间', 'value' => date('Y/m/d H:i:s', $info['create_time'])],
                ['label' => '商品总价', 'value' => $info['price']],
                ['label' => '手续费', 'value' => $info['fee'] + $info['level_fee']],
                ['label' => '快递费', 'value' => $info['post_fee'] + $info['after_post_fee']],
                ['label' => '附加服务费', 'value' => $info['value_added_fee']],
//            ['label' => '超时支付费用','value' => $info['over_time_fee']],
                ['label' => '总金额(日元)', 'value' => $info['amount']],
                ['label' => '总金额(人民币)', 'value' => $info['amount_rmb']]
            ];

            $info['photos'] = Db::name('order_photos')
                ->where('order_id',$id)
                ->column("uri");

            $info['shop'] = OrderModel::getShopArr($info['shop']);
            return $this->jsuccess('ok', ['detail' => $info, 'itemList' => $itemList]);
        } catch (\Exception $e) {
            return $this->jerror($e->getMessage());
        }

    }

    /**
     * 追加备注内容
     */
    public function addremark(){
        $id = input('id', '');
        if (intval($id) <= 0) {
            $this->jerror('错误的请求');
        }
        try {
            $remark = input('remark','');
            if(empty($remark) || mb_strlen($remark) > 100){
                return $this->jerror('请输入100字以内备注信息');
            }
            $info = Db::name('orders')
                ->where('uid', $this->uid)
                ->where('id', intval($id))
                ->find();
            if (!$info) {
                return $this->jerror('该订单不存在');
            }
            if(!in_array($info['status'],[0,1,2,3])){
                return $this->jerror('订单已经出库，不可追加备注');
            }

            $remarkArr = !empty($info['user_remark'])?explode(PHP_EOL,$info['user_remark']):[];
            $remarkArr[] = date('m/d').':'.$remark;

            $remark = implode(PHP_EOL,$remarkArr);
            if(mb_strlen($remark) > 200){
                return $this->jerror('总备注内容，不得超过200字');
            }

            $res = Db::name('orders')
                ->where('uid', $this->uid)
                ->where('id', intval($id))
                ->save(['user_remark' => $remark]);
            if(!$res){
                return $this->jerror('操作失败');
            }
            $res = OrderModel::addLog($this->uid,0,$id,$remark,'');
            return $this->jsuccess('ok', '操作成功');
        } catch (\Exception $e) {
            return $this->jerror($e->getMessage());
        }
    }


    /**
     * 订单列表
     */
    public function mine()
    {
        $kw = input('kw', '');
        $where = [['o.uid', '=', $this->uid],['o.is_show','=',1]];
        if (!empty($kw)) {
            $where[] = ['o.trade_no|o.out_trade_no|o.goods_name|o.postcode', 'like', "%$kw%"];
        }
        $status = input('status');
        if ($status == 2) {
            $where[] = ['o.status', 'in', [1, 2]];
        } else if ($status == -1) {
            $where[] = ['o.status', 'in', [-1, 6, 7]];
        }
        if (in_array($status, [0, 3, 4, 5])) {
            $where[] = ['o.status', '=', $status];
        }

        $levelInfo = Db::name('user_levels')
            ->where('id', $this->userInfo['level'])
            ->find();

        $storeDays = $levelInfo ? $levelInfo['store_days'] : 30;

        $result = Db::name('orders')
            ->alias('o')
            ->where($where)
            ->field('id,store_time,out_trade_no,goods_name,weight,shop,status,quantity,create_mid as amid,cover,price,ext_goods_no,seller,seller_address,fee,post_fee,level_fee,amount,amount_rmb,create_time')
            ->order('o.id desc')
            ->paginate(20)->toArray();
        $list = $result['data'];
        foreach ($list as &$item) {
            $item['url'] = \app\common\model\Goods::getUrl($item['shop'], $item['ext_goods_no']);
            $item['status_txt'] = OrderModel::getStatusArr($item['status']);
            $item['cover'] = oss_url($item['cover']);
            $item['shop'] = OrderModel::getShopArr($item['shop']);
            $item['checked'] = false;
            if ($item['status'] == 3) {
                $item['left_time'] = strtotime("+$storeDays day", $item['store_time']) - time();
            }
        }
        return $this->jsuccess('ok', ['list' => $list, 'total' => intval($result['total']), 'totalPages' => ceil($result['total'] / 20)]);
    }

    /**
     * 隐藏订单
     */
    public function delorder()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $id = input('id', 0);
        if (intval($id) <= 0) {
            return $this->jerror('错误的操作');
        }
        $orderInfo = (new OrderModel())
            ->where('id',intval($id))
            ->where('uid',$this->uid)
            ->find();
        if(!$orderInfo){
            return $this->jerror('该订单不存在');
        }
        if(!in_array($orderInfo['status'],[-1,5,7])){
            return $this->jerror('该订单还没完成，无法删除');
        }
        $res = $orderInfo->save(['is_show' => 0]);
        if($res){
            return $this->jsuccess('删除成功');
        }
        return $this->jerror('删除失败');
    }

    /**
     * 取消订单
     */
    public function cancel()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }

        $id = input('id', 0);
        if (intval($id) <= 0) {
            return $this->jerror('错误的操作');
        }
        $info = (new OrderModel())
            ->where('uid',$this->uid)
            ->where('id',intval($id))
            ->find();
        if($info['is_pay'] > 0  || $info['create_mid'] > 0){
            return $this->jerror('请联系客服取消');
        }
        //-- 开始处理
        list($err, $result) = (new OrderModel())->cancelOrder($id, $this->uid, 0);
        if ($err != 0) {
            return $this->jerror($result);
        }
        return $this->jsuccess($result);
    }

    /**
     * 出库订单
     */
    public function shipments()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }

        $map = [['so.uid', '=', $this->uid],['so.is_show','=',1]];

        $status = input('status', 0);
        if ($status == 0) {
            $map[] = ['so.status', 'in', [0, 1]];
        } else if ($status == -1) {
            $map[] = ['so.status', 'in', [-1, 4, 5]];
        } else if (in_array($status, [2, 3,6])) {
            $map[] = ['so.status', '=', intval($status)];
        }

        $result = Db::name('shipment_orders')
            ->alias('so')
            ->where($map)
            ->field('so.realname,so.is_share,so.mobile,so.postcode,so.id,so.orderids,so.order_json,so.status,so.out_trade_no,so.amount,so.amount_rmb,so.weight,so.ship_way,u.nickname,s.method_name as ship_way_txt')
            ->join('st_users u', 'u.id=so.uid', 'LEFT')
            ->join('st_shipments s', 's.method_code=so.ship_way', 'LEFT')
            ->order('so.id desc')
            ->paginate(10)->toArray();

        $list = $result['data'];
        foreach ($list as &$sitem) {
            $sitem['shop'] = '出库';
            $sitem['status_txt'] = ShipOrders::getStatusArr($sitem['status']);
            $sitem['childs'] = json_decode($sitem['order_json'], true);
            foreach ($sitem['childs'] as &$order) {
                $order['cover'] = oss_url($order['cover']);
            }
            $sitem['open'] = 0;
            unset($sitem['order_json']);
        }

        return $this->jsuccess('ok', ['list' => $list, 'totalPages' => ceil($result['total'] / 10)]);
    }

    /**
     * 隐藏订单
     */
    public function delshiporder()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $id = input('id', 0);
        if (intval($id) <= 0) {
            return $this->jerror('错误的操作');
        }
        $orderInfo = (new ShipOrders())
            ->where('id',intval($id))
            ->where('uid',$this->uid)
            ->find();
        if(!$orderInfo){
            return $this->jerror('该订单不存在');
        }
        if(!in_array($orderInfo['status'],[-1,5,6])){
            return $this->jerror('该订单还没完成，无法删除');
        }
        $res = $orderInfo->save(['is_show' => 0]);
        if($res){
            return $this->jsuccess('删除成功');
        }
        return $this->jerror('删除失败');
    }

    /**
     * 取消出库
     */
    public function cancelship()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        return $this->jerror('请联系客服取消');
        $this->requestLimit(30);
        $id = input('id', 0);
        if (intval($id) <= 0) {
            return $this->jerror('错误的操作');
        }
        //-- 开始处理
        list($err, $result) = (new ShipOrders())->cancelShipOrder($id, $this->uid, 0);
        $this->clearRequestLimit();
        if ($err != 0) {
            return $this->jerror($result);
        }
        return $this->jsuccess($result);
    }

    /**
     * 确认收货
     */
    public function doneship()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $this->requestLimit(30);
        $id = input('id', 0);
        if (intval($id) <= 0) {
            return $this->jerror('错误的操作');
        }
        //-- 开始处理
        list($err, $result) = (new ShipOrders())->doneShipOrder($id, $this->uid, 0);
        $this->clearRequestLimit();
        if ($err != 0) {
            return $this->jerror($result);
        }
        return $this->jsuccess($result);
    }

    /**
     * 检查出库订单
     */
    public function checkShip()
    {
        $ids = $this->request->post('ids', '');
        if (empty($ids)) {
            $this->jerror('请选择处理的订单');
        }
        $idArr = explode(',', $ids);
        $orderList = Db::name('orders')
            ->where('status', 3)
            ->where('id', 'in', $idArr)
            ->where('uid', $this->uid)
            ->field('id,goods_name,cover,amount,price,shop,amount_rmb,weight')
            ->select()->toArray();
        if (count($orderList) != count($idArr)) {
            $this->jerror('选择的订单异常');
        }
        //-- 获取国际物流
        $shipWayList = Db::name('shipments')
            ->where('is_deleted',0)
            ->select()->toArray();
        $totalWeight = array_sum(array_column($orderList, 'weight'));
        $valueList = Db::name('value_added')->where('type','ship')->select()->toArray();
        return $this->jsuccess('ok', ['list' => $orderList, 'total_weight' => $totalWeight, 'shipways' => $shipWayList,'values' => $valueList]);
    }

    /**
     * 出库操作
     */
    public function doship()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('出库操作');
        }

        $this->requestLimit(30);

        $ids = $this->request->post('ids', '');
        if (empty($ids)) {
            $this->clearRequestLimit();
            $this->jerror('请选择处理的订单');
        }
        $idArr = explode(',', $ids);
        if (count($idArr) > 99) {
            return $this->jerror('单次最多出库99个货物，可以分批出库，备注合箱');
        }

        $orderList = Db::name('orders')
            ->where('status', 3)
            ->where('id', 'in', $idArr)
            ->where('uid', $this->uid)
            ->field('id,goods_name,cover,amount,price,shop,amount_rmb,weight')
            ->select()->toArray();
        if (count($orderList) != count($idArr)) {
            $this->clearRequestLimit();
            $this->jerror('选择的订单异常');
        }

        //-- 检查地址
        $addressId = input('aid', '');
        if (intval($addressId) <= 0) {
            $this->clearRequestLimit();
            return $this->jerror('请选择地址');
        }
        $addressInfo = Db::name('address')
            ->where('id', intval($addressId))
            ->where('uid', $this->uid)
            ->where('is_deleted', 0)
            ->find();
        if (!$addressInfo) {
            $this->clearRequestLimit();
            return $this->jerror('该地址不存在');
        }

        //-- 检查物流方式
        $shipWay = input('ship_way', 0);
        $shipInfo = Db::name('shipments')
            ->where('method_code', intval($shipWay))
            ->find();
        if (!$shipInfo) {
            $this->clearRequestLimit();
            return $this->jerror('该物流方式不存在');
        }

        //-- 检查申报单
        $goodsJson = input('goodsList', '');
        $goodsList = [];
        $goodsArr = json_decode($goodsJson, true);
        if (!empty($goodsArr) && count($goodsArr) > 0) {
            foreach ($goodsArr as $item) {
                if (!empty(trim($item['name'])) && intval($item['number']) > 0 && intval($item['price']) > 0) {
                    $goodsList[] = ['name' => trim($item['name']), 'number' => intval($item['number']), 'price' => intval($item['price'])];
                }
            }

            if (count($goodsList) <= 0) {
                $this->clearRequestLimit();
                return $this->jerror('请完整输入申报单');
            }
        }
        if(empty($goodsList)){
            return $this->jerror('请完整输入申报单');
        }
        $remark = input('remark', '');
        $valueAdded = input('value_added','');

        $data = [
            'orderids' => $ids,
            'uid' => $this->uid,
            'realname' => $addressInfo['realname'],
            'mobile' => $addressInfo['mobile'],
            'country' => $addressInfo['country'],
            'province' => $addressInfo['province'],
            'city' => $addressInfo['city'],
            'postno' => $addressInfo['postno'],
            'address' => $addressInfo['address'],
            'area' => $addressInfo['area'],
            'ship_way' => intval($shipWay),
            'value_added' => $valueAdded,
            'goods_list' => json_encode($goodsList, JSON_UNESCAPED_UNICODE),
            'iskefu_help' => empty($goodsList)?1:0,
            'remark' => trim($remark)
        ];

        try {

            list($err, $result) = (new ShipOrders())->addRow($data);
            if ($err != 0) {
                $this->clearRequestLimit();
                return $this->jerror($result);
            }
            $this->clearRequestLimit();
            return $this->jsuccess('出库申请成功');
        } catch (\Exception $e) {
            $this->clearRequestLimit();
            return $this->jerror($e->getMessage());
        }
    }



    /**
     * 订单详情
     */
    public function shipdetail()
    {
        $id = input('id', '');
        if (intval($id) <= 0) {
            $this->jerror('错误的请求');
        }
        $info = Db::name('shipment_orders')
            ->where('uid', $this->uid)
            ->where('id', intval($id))
            ->field('id,out_trade_no,out_trade_no,remark,store_remark,post_picture,weight,ship_way,postcode,goods_list,amount,rate,amount_rmb,after_post_fee,post_fee,pack_fee,over_time_fee,order_json,status,realname,mobile,address,create_time')
            ->find();
        if (!$info) {
            return $this->jerror('该订单不存在');
        }
        $info['create_time_txt'] = date('Y/m/d H:i:s', $info['create_time']);
        $shipInfo = Db::name('shipments')->where('method_code', $info['ship_way'])->column('method_name');
        $info['post_method'] = $shipInfo ? $shipInfo[0] : '';
        $info['mobile'] = str_replace(substr($info['mobile'], 3, 4), '****', $info['mobile']);
        $rate = $info['rate'];
        if ($rate <= 0 && $info['amount'] > 0) {
            $rate = round($info['amount_rmb'] / $info['amount'], 2);
        }
        $itemList = [
//            ['label' => '订单编号','value' => $info['out_trade_no']],
//            ['label' => '申请时间','value' => date('Y/m/d H:i:s',$info['create_time'])],
//            ['label' => '物流公司','value' => $shipInfo?$shipInfo:''],
//            ['label' => '物流号','value' => $info['postcode']?:'无'],
            ['label' => '物流费用', 'value' => ($info['post_fee'] <= 0 ? 0.00 : ceil(round($info['post_fee'] * $rate, 2))) . '元'],
            ['label' => '包装费用', 'value' => ($info['pack_fee'] <= 0 ? 0.00 : ceil(round($info['pack_fee'] * $rate, 2))) . '元'],
            ['label' => '到付快递费', 'value' => ($info['after_post_fee'] <= 0 ? 0.00 : ceil(round($info['after_post_fee'] * $rate, 2))) . '元'],
            ['label' => '超时存放费用', 'value' => ($info['over_time_fee'] <= 0 ? 0.00 : ceil(round($info['over_time_fee'] * $rate, 2))) . '元'],
//            ['label' => '总金额(日元)','value' => $info['amount']],
            ['label' => '总金额', 'value' => $info['amount_rmb'] . '元']
        ];

        $info['orderList'] = json_decode($info['order_json'], true);
        unset($info['order_json']);
        $info['shop'] = '出库订单';
        $goodsList = json_decode($info['goods_list'], true);
        unset($info['goods_list']);
        if(!empty($info['post_picture'])){
            $info['post_picture'] = $this->parsepic( $info['post_picture']);
        }
        return $this->jsuccess('ok', ['detail' => $info, 'itemList' => $itemList, 'goodsList' => $goodsList ?? []]);
    }

    /**
     * 修改地址
     */
    public function editaddress(){
        $id = input('id', '');
        if (intval($id) <= 0) {
            $this->jerror('错误的请求');
        }
        try {
            $info = Db::name('shipment_orders')
                ->where('uid', $this->uid)
                ->where('id', intval($id))
                ->find();
            if (!$info) {
                return $this->jerror('该订单不存在');
            }
            if($info['status'] > 1){
                return $this->jerror('已支付订单不允许修改地址，请联系客服处理');
            }
            //-- 检查地址
            $addressId = input('aid', '');
            if (intval($addressId) <= 0) {
                return $this->jerror('请选择地址');
            }
            $addressInfo = Db::name('address')
                ->where('id', intval($addressId))
                ->where('uid', $this->uid)
                ->where('is_deleted', 0)
                ->find();
            if (!$addressInfo) {
                return $this->jerror('该地址不存在');
            }
            $data = [
                'realname' => $addressInfo['realname'],
                'mobile' => $addressInfo['mobile'],
                'country' => $addressInfo['country'],
                'province' => $addressInfo['province'],
                'city' => $addressInfo['city'],
                'postno' => $addressInfo['postno'],
                'address' => $addressInfo['address'],
                'area' => $addressInfo['area'],
            ];

            $model = new ShipOrders();
            $model->startTrans();;
            $res = $model
                ->where('uid', $this->uid)
                ->where('id', intval($id))
                ->update($data);
            if(!$res){
                $model->rollback();
                return $this->jerror('修改地址失败');
            }
            $res = ShipOrders::addShipLog($id,'用户修改了收货地址');
            if(!$res){
                $model->rollback();
                return $this->jerror('修改地址失败');
            }
            $model->commit();
            return $this->jsuccess('修改成功');
        }catch (\Exception $e){
            return $this->jerror($e->getMessage());
        }

    }

    /**
     * 修改申报单
     */
    public function editdeclaration(){
        $id = input('id', '');
        if (intval($id) <= 0) {
            $this->jerror('错误的请求');
        }
        try {
            $info = Db::name('shipment_orders')
                ->where('uid', $this->uid)
                ->where('id', intval($id))
                ->find();
            if (!$info) {
                return $this->jerror('该订单不存在');
            }
            if($info['status'] > 1){
                return $this->jerror('已支付订单不允许修改地址，请联系客服处理');
            }
            //-- 检查申报单
            $goodsJson = input('goodsList', '');
            $goodsList = [];
            $goodsArr = json_decode($goodsJson, true);
            if(empty($goodsArr)){
                return $this->jerror('请完整输入申报单');
            }
            foreach ($goodsArr as $item) {
                if (!empty(trim($item['name'])) && intval($item['number']) > 0 && intval($item['price']) > 0) {
                    $goodsList[] = ['name' => trim($item['name']), 'number' => intval($item['number']), 'price' => intval($item['price'])];
                }
            }

            if (count($goodsList) <= 0) {
                return $this->jerror('请完整输入申报单');
            }
            $data = [
                'goods_list' => json_encode($goodsList, JSON_UNESCAPED_UNICODE)
            ];

            $model = new ShipOrders();
            $model->startTrans();;
            $res = $model
                ->where('uid', $this->uid)
                ->where('id', intval($id))
                ->update($data);
            if(!$res){
                $model->rollback();
                return $this->jerror('修改申报单失败');
            }
            $res = ShipOrders::addShipLog($id,'用户修改了申报单');
            if(!$res){
                $model->rollback();
                return $this->jerror('修改申报单失败');
            }
            $model->commit();
            return $this->jsuccess('修改成功');
        }catch (\Exception $e){
            return $this->jerror($e->getMessage());
        }
    }

    /**
     * 查看快递
     * @return \think\response\Json
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public function express()
    {
        $id = input('id', '');
        if (intval($id) <= 0) {
            $this->jerror('错误的请求');
        }
        $info = Db::name('shipment_orders')
            ->alias('so')
            ->where('so.uid', $this->uid)
            ->where('so.id', intval($id))
            ->join('st_shipments s','s.method_code=so.ship_way','LEFT')
            ->field('so.postcode,s.method_name')
            ->find();
        if (!$info) {
            return $this->jerror('该订单不存在');
        }
        if (empty($info['postcode'])) {
            return $this->jerror('该订单还未发货');
        }
        $key = 'order_express:' . $info['postcode'];
        $redis = new StRedis();
        $json = $redis->get($key);
        if (!empty($json)) {
            return $this->jsuccess('ok', ['name' => $info['method_name'],'code' => $info['postcode'],'list' => json_decode($json, true)]);
        }
        $kuaidi = new Kuaidi100();
        $result = $kuaidi->query('ems', $info['postcode']);
        if (!$result || !isset($result['data'])) {
            return $this->jerror($result['message']??'查询失败');
        }
        $list = $result['data'];
        foreach ($list as &$item){
            $item['ftime'] = date('Y年m月d日 H:i:s',strtotime($item['ftime']));
        }
        $redis->set($key, json_encode($list), 1800);
        return $this->jsuccess('ok', ['name' => $info['method_name'],'code' => $info['postcode'],'list' => $list]);
    }
}