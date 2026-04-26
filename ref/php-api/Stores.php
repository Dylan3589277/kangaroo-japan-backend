<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 15:12
 * description: 仓库管理，仅限管理员权限
 */

namespace app\api\controller;

use app\common\library\Printer;
use app\common\library\Wecom;
use app\common\logic\MnpAlertLogic;
use app\common\model\Configs;
use app\common\model\OrderModel;
use app\common\model\ShipOrders;
use think\App;
use think\facade\Db;

class Stores extends Base
{
    private $admin = null;

    public function __construct(App $app)
    {
        parent::__construct($app);
        $this->checkAuth();
    }

    /**
     * 必须跟后台绑定的管理员手机一致才行
     */
    private function checkAuth()
    {
        if (empty($this->userInfo['mobile'])) {
            return $this->jerror('您没有访问权限');
        }
        $admin = Db::name('member')
            ->where('phone', $this->userInfo['mobile'])
            ->where('status', 1)
            ->find();
        if (!$admin) {
            return $this->jerror('你没有访问权限');
        }
        $this->admin = $admin;
        return $admin;
    }

    /**
     * 待入库订单
     * @return \think\response\Json|\think\response\View
     */
    public function orders()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $kwtype = input('post.kwtype', '');
        $where = [['o.status', '=', 2], ['o.is_pay', '=', 1]];
        if (!in_array($kwtype, ['seller', 'postcode'])) {
            return $this->orderlist($where);
        }
        $kw = input('post.kw', '');
        if (empty($kw)) {
            $this->jerror('关键词不能为空');
        }
        $sellerWhere = $where;
        $sellerWhere[] = ['o.postcode', '=', ''];
        $orderList = [];
        if ($kwtype == 'postcode') {
            $where[] = ['o.postcode', '=', $kw];
            $orderList = Db::name('orders')
                ->alias('o')
                ->where($where)
                ->field('o.*,u.nickname,u.mobile,u.code as ucode')
                ->join('st_users u', 'u.id=o.uid', 'LEFT')
                ->select()->toArray();
            if (!$orderList || count($orderList) <= 0) {
                $this->jerror('该快递号没有对应的待入库订单');
            }
            foreach ($orderList as &$oitem) {
                $oitem['shop'] = OrderModel::getShopArr($oitem['shop']);
            }
            $sellerWhere[] = ['o.seller', '=', $orderList[0]['seller']];
            $sellerWhere[] = ['o.shop', '=', $orderList[0]['shop']];
        }
        else {
            $sellerWhere[] = ['o.seller', '=', $kw];
        }

        $sellerList = Db::name('orders')
            ->alias('o')
            ->where($sellerWhere)
            ->field('o.*,u.nickname,u.mobile,u.code as ucode')
            ->join('st_users u', 'u.id=o.uid', 'LEFT')
            ->select()->toArray();
        foreach ($sellerList as &$sitem) {
            $remark = sprintf('用户:%s;客服:%s',empty($sitem['user_remark'])?'':$sitem['user_remark'],empty($sitem['remark'])?'':$sitem['remark']);
            $item['remark'] = $remark;
            $item['postcode'] = empty($item['postcode'])?'':$item['postcode'];
            $sitem['shop'] = OrderModel::getShopArr($sitem['shop']);
        }

        return $this->jsuccess('ok', ['list' => $orderList, 'sellerList' => $sellerList ? $sellerList : []]);
    }

    public function index()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $status = input('status', 3);
        $where = [['o.status', '=', intval($status)], ['o.is_pay', '=', 1]];
        return $this->orderlist($where);
    }

    /**
     * 订单列表
     * @param $where
     * @return \think\response\Json
     */
    private function orderlist($where)
    {
        $kw = input('kw', '');
        if (!empty($kw)) {
            $where[] = ['o.trade_no|o.out_trade_no|o.goods_name|o.postcode', 'like', "%$kw%"];
        }
        $uid = input('uid', 0);
        if (intval($uid) > 0) {
            $where[] = ['o.uid', '=', intval($uid)];
        }
        $shop = input('shop', '');
        if (!empty($shop)) {
            $where[] = ['o.shop', '=', $shop];
        }
        $result = Db::name('orders')
            ->alias('o')
            ->where($where)
            ->field('o.*,u.nickname,u.mobile,u.realname,u.taobaoid,u.code as ucode')
            ->join('st_users u', 'u.id=o.uid', 'LEFT')
            ->order('o.id desc')
            ->paginate(20)->toArray();
        $list = $result['data'];
        foreach ($list as &$item) {
            $item['remark'] = empty($item['user_remark'])?'':$item['user_remark'];
            $item['postcode'] = empty($item['postcode'])?'':$item['postcode'];
            $item['cover'] = oss_url($item['cover']);
            $item['status_txt'] = OrderModel::getStatusArr($item['status']);
            $item['shop'] = OrderModel::getShopArr($item['shop']);
            $item['store_time'] = $item['store_time'] > 0?date('Y/m/d H:i:s',$item['store_time']):'';
        }
        return $this->jsuccess('ok', ['list' => $list, 'totalPages' => ceil($result['total'] / 200)]);
    }


    /**
     * 入库
     */
    public function instore()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $ids = $this->request->post('ids', '');
        if (empty($ids)) {
            $this->jerror('请选择处理的订单');
        }
        $idArr = explode(',', $ids);
//        $groupArr = explode(',', $this->admin['order_cats']);
        $orderList = Db::name('orders')
//            ->where('cat', 'in', $groupArr)
            ->where('status', 2)
            ->where('id', 'in', $idArr)
            ->select()->toArray();
        if (count($orderList) != count($idArr)) {
            $this->jerror('选择的订单异常');
        }
        $weight = $this->request->post('weight', 0);
        if (floatval($weight) <= 0) {
            $this->jerror('请输入重量');
        }
        $afterFee = $this->request->post('after_post_fee', '');
        $area = input('area', '');

        $weight = round(floatval($weight) / count($orderList), 2);
        $afterFee = round(floatval($afterFee) / count($orderList), 2);
        Db::startTrans();
        try {
            $res = Db::name('orders')
                ->where('id', 'in', $idArr)
                ->save(['status' => 3, 'weight' => $weight, 'store_time' => time(), 'store_area' => $area, 'after_post_fee' => $afterFee, 'last_update_mid' => $this->admin['uid'], 'update_time' => time()]);
            if (!$res) {
                throw new \Exception('修改订单状态失败');
            }
            foreach ($orderList as $order) {
                $res = OrderModel::addLog(0, $this->admin['uid'], $order['id'], '订单入库', json_encode(input('post.'), JSON_UNESCAPED_UNICODE));
                if (!$res) {
                    throw new \Exception('日志处理失败');
                }
            }
            Db::commit();

            //-- 公众号提醒
            foreach ($orderList as $order) {
                MnpAlertLogic::addAlertMsg('instore',$order['uid'],['order_id' => $order['id']]);
            }
            //打印
            Printer::printLabel(array_column($orderList,'id'));
            return $this->jsuccess('处理成功', ['time' => date('Y/m/d H:i:s')]);
        }
        catch (\Exception $e) {
            Db::rollback();
            $this->jerror('处理失败' . $e->getMessage());
        }

    }

    /**
     * 取消入库
     */
    public function cancelstore(){
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $id = $this->request->post('id', '');
        if (intval($id) <= 0) {
            $this->jerror('请选择处理的订单');
        }
        $orderInfo = Db::name('orders')
//            ->where('cat', 'in', $groupArr)
            ->where('status', 3)
            ->where('id', $id)
            ->find();
        if (!$orderInfo) {
            $this->jerror('不存在该入库订单');
        }

        Db::startTrans();
        try {
            $res = Db::name('orders')
                ->where('id', intval($id))
                ->save(['status' => 2, 'weight' => 0, 'store_time' => 0, 'store_area' => '', 'after_post_fee' => 0, 'last_update_mid' => $this->admin['uid'], 'update_time' => time()]);
            if (!$res) {
                throw new \Exception('修改订单状态失败');
            }
            $res = OrderModel::addLog(0, $this->admin['uid'], $orderInfo['id'], '订单取消入库', json_encode(input('post.'), JSON_UNESCAPED_UNICODE));
            if (!$res) {
                throw new \Exception('日志处理失败');
            }
            Db::commit();
            return $this->jsuccess('处理成功', ['time' => date('Y/m/d H:i:s')]);
        }
        catch (\Exception $e) {
            Db::rollback();
            $this->jerror('处理失败' . $e->getMessage());
        }
    }

    public function config()
    {
        //-- 获取仓库区划
        $areaList = Db::name('cats')
            ->field('name')
            ->where('type', 'store')
            ->select()->toArray();
        //-- 获取国际物流
        $shipPricesList = Db::name('shipment_prices')
            ->where('area',1)
            ->field('method_code,weight_limit,ship_amount')
            ->order('weight_limit desc')
            ->select()->toArray();
        //-- 在库数量
        $storeNum = Db::name('orders')
            ->where('status', 3)
            ->count();
        //-- 出库申请
        $shipNum = Db::name('shipment_orders')
            ->where('status', 0)
            ->count();
        //-- 待拍照订单
        $photoNum = Db::name('orders')
            ->where('photo',1)
            ->where('is_pay',1)
            ->count();
        //-- 汇率
        $configArr = (new Configs())->getAllArr();
        $data = [
            'admin' => ['realname' => $this->admin['realname']],
            'store_num' => intval($storeNum),
            'ship_num' => intval($shipNum),
            'photo_num' => intval($photoNum),
            'areas' => $areaList,
            'rate' => $configArr['EXCHANGE_RATE'],
            'shipprices' => $shipPricesList];
        return $this->jsuccess('ok', $data);
    }

    /**
     * 出库订单
     * @return \think\response\Json|\think\response\View
     */
    public function ships()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        try{
            $map = [];
            $status = input('status');
            if (intval($status) >= 0) {
                $map[] = ['so.status', '=', intval($status)];
            }
            $map2 = $map;
            $kw = input('kw','');
            if(!empty($kw)){
                $map[] = ['u.code','=',$kw];
            }

            $result = Db::name('shipment_orders')
                ->alias('so')
                ->where($map)
                ->field('so.id,so.remark,so.value_added,so.uid,so.out_trade_no,so.realname,so.country,so.province,so.city,so.address,so.mobile,so.status,so.mobile,so.address,so.order_json,so.ship_way,u.nickname,u.code,s.method_name as ship_way_txt')
                ->join('st_users u', 'u.id=so.uid', 'LEFT')
                ->join('st_shipments s', 's.method_code=so.ship_way', 'LEFT')
                ->order('so.id desc')
                ->paginate(10)->toArray();
            //-- 获取关联的订单


            $countUserList = Db::name('shipment_orders')
                ->alias('so')
                ->where($map2)
                ->field('count(so.id) as number,so.uid')
                ->group('so.uid')
                ->select()->toArray();
            $orderArr = array_column($countUserList??[],'number','uid');

            $valuesList = Db::name('value_added')
                ->select()->toArray();
            $valueArr = array_column($valuesList,'name','id');

            $list = $result['data'];
            foreach ($list as &$sitem) {
                $sitem['status_txt'] = ShipOrders::getStatusArr($sitem['status']);
                $sitem['childs'] = json_decode($sitem['order_json'], true);
                foreach ($sitem['childs'] as &$order){
                    $order['cover'] = oss_url($order['cover']);
                }
                $sitem['total_weight'] = round(array_sum(array_column($sitem['childs'],'weight')),2);
                $sitem['total_amount'] = round(array_sum(array_column($sitem['childs'],'amount_rmb')),2);
                $sitem['ship_way_txt'] = $sitem['ship_way_txt']?:'';
                $sitem['nickname'] = $sitem['nickname'].'#'.$sitem['code'];
                $sitem['open'] = 0;
                unset($sitem['order_json']);
                if(!empty($sitem['value_added'])){
                    $valueAdded = explode(',',$sitem['value_added']);
                    $goods = [];
                    foreach ($valueAdded as $val){
                        $goods[] = $valueArr[$val];
                    }
                    $sitem['value_added'] = implode(',',$goods);
                }
                $sitem['shipping_number'] = $orderArr[$sitem['uid']]??0;
            }

            return $this->jsuccess('ok', ['list' => $list, 'total' => $result['total']]);
        }catch (\Exception $e){
            return $this->jerror($e->getMessage());
        }

    }

    /**
     * 出库申请
     * @return array|\think\response\Json
     */
    public function checkship()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        try{

        $id = input('id', '');
        $uid = input('uid', '');
        if(intval($uid) > 0){
            return $this->getallship();
        }
        if (intval($id) <= 0) {
            return $this->jerror('错误的操作');
        }
        $orderInfo = Db::name('shipment_orders')
            ->where('id', intval($id))
            ->find();
        if (!$orderInfo) {
            return $this->jerror('该出库申请不存在');
        }
        if (!in_array($orderInfo['status'], [0, 1,2])) {
            return $this->jerror('该出库申请订单异常');
        }

        $rate = \think\facade\Config::get('config.SHIP_EXCHANGE_RATE');
        $userInfo = Db::name('users')
            ->alias('u')
            ->where('u.id', $orderInfo['uid'])
            ->field('u.*,l.name as level_name,l.ship_rate,l.over_time_fee,l.store_days')
            ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
            ->find();
        if (!$userInfo) {
            return [1, '该用户不存在'];
        }

        $result = Db::name('shipment_orders')
            ->alias('so')
            ->where('id', $id)
            ->field('so.id,so.ship_way,so.value_added,so.realname,so.status,so.mobile,so.address,so.orderids,so.remark,s.method_name')
            ->join('st_shipments s', 's.method_code=so.ship_way', 'LEFT')
            ->find();
        $orderList = Db::name('orders')
            ->where('id', 'in', explode(',', $result['orderids']))
            ->field('id,out_trade_no,goods_name,cover,weight,store_area,ext_goods_no,shop,store_time')
            ->select()->toArray();
        foreach ($orderList as &$item){
            $item['shop_txt'] = OrderModel::getShopArr($item['shop']);
            $item['store_time'] = date('Y/m/d H:i:s',$item['store_time']);
        }
        $result['childs'] = $orderList;
        $result['user'] = ['code' => $userInfo['code'],'mobile' => $userInfo['mobile']];

        //-- 计算包装费用
        $valueAdded = '';
        $packFee = 0;
        if(!empty($result['value_added'])){
            $valueList = Db::name('value_added')
                ->where('id','in',explode(',',$result['value_added']))
                ->select()->toArray();
            $valueAdded = implode(',',array_column($valueList,'name'));
            $packFee = array_sum(array_column($valueList,'price'));
        }


        $rate = floatval($rate) + floatval($userInfo['ship_rate']);
        return $this->jsuccess('ok', ['info' => $result,'value_added' => $valueAdded,'pack_fee' => $packFee, 'rate' => $rate, 'after_post_fee' => $orderInfo['after_post_fee'], 'over_time_fee' => $orderInfo['over_time_fee']]);

        }catch (\Exception $e){
            return $this->jerror($e->getMessage());
        }
    }

    /**
     * 获取用户所有的订单
     * @return array|\think\response\Json
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public function getallship()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $id = input('uid', '');
        if (intval($id) <= 0) {
            return $this->jerror('错误的操作');
        }
        $userInfo = Db::name('users')
            ->alias('u')
            ->where('u.id', $id)
            ->field('u.*,l.name as level_name,l.ship_rate,l.over_time_fee,l.store_days')
            ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
            ->find();
        if (!$userInfo) {
            return [1, '该用户不存在'];
        }

        $list = Db::name('shipment_orders')
            ->alias('so')
            ->where('uid', $id)
            ->where('status',0)
            ->field('so.id,so.ship_way,so.realname,so.status,so.mobile,so.address,so.orderids,so.remark')
            ->select()->toArray();

        if(empty($list)){
            return $this->jerror('该用户不存在出库订单');
        }
        $orderArr = [];
        foreach ($list as $item){
            $orderArr = array_merge($orderArr,explode(',', $item['orderids']));
        }

        $shipOrderIdArr = array_column($list,'id');
        $shipOrderIdArr = array_flip($shipOrderIdArr);

        $orderList = Db::name('orders')
            ->where('id', 'in', $orderArr)
            ->field('id,out_trade_no,goods_name,cover,weight,store_area,ext_goods_no,shop,store_time,ship_order_id')
            ->order('store_area asc')
            ->select()->toArray();
        foreach ($orderList as &$item){
            $item['shop_txt'] = OrderModel::getShopArr($item['shop']);
            $item['store_time'] = date('Y/m/d H:i:s',$item['store_time']);
            $item['number'] = $shipOrderIdArr[$item['ship_order_id']] + 1;
        }
        $result = [];
        $result['user'] = ['code' => $userInfo['code'],'mobile' => $userInfo['mobile']];
        $result['childs'] = $orderList;


        return $this->jsuccess('ok', ['info' => $result, 'rate' => 0, 'after_post_fee' => 0, 'over_time_fee' => 0]);
    }

    /**
     * 盘货
     */
    public function confirm()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $id = input('id', '');
        $weight = input('weight', 0);
        $postFee = input('post_fee', 0);
        $packFee = input('pack_fee', 0);
        if (intval($id) <= 0) {
            return $this->jerror('请输入完整');
        }

        if($postFee <=0){
            return $this->jerror('请输入物流费用');
        }

        $orderInfo = Db::name('shipment_orders')
            ->where('id', intval($id))
            ->find();
        if (!$orderInfo) {
            return $this->jerror('该出库申请不存在');
        }
        if (!in_array($orderInfo['status'], [0, 1])) {
            return $this->jerror('该出库申请订单异常');
        }

        $rate = \think\facade\Config::get('config.SHIP_EXCHANGE_RATE');
        $userInfo = Db::name('users')
            ->alias('u')
            ->where('u.id', $orderInfo['uid'])
            ->field('u.*,l.name as level_name,l.ship_rate,l.over_time_fee,l.store_days')
            ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
            ->find();
        if (!$userInfo) {
            return $this->jerror('用户异常');
        }

        $rate = floatval($rate) + floatval($userInfo['ship_rate']);

        $amount = input('amount', 0);
        if (intval($amount) <= 0) {
            return $this->jerror('请输入总费用');
        }
        $amountRmb = ceil($amount * $rate);

        $data = [
            'amount' => $amount,
            'amount_rmb' => $amountRmb,
            'rate' => $rate,
            'status' => 1,
            'weight' => $weight,
            'post_fee' => $postFee,
            'pack_fee' => floatval($packFee),
            'update_time' => time(),
            'last_update_mid' => $this->admin['uid']
        ];

        $res = Db::name('shipment_orders')
            ->where('id', intval($id))
            ->where('status', 'in', [0, 1])
            ->save($data);

        if (!$res) {
            return $this->jerror('处理失败');
        }

        //-- 发送消息
        Wecom::addAlertMsg('confirm_ship_order',intval($id));
        //-- 公众号提醒
        MnpAlertLogic::addAlertMsg('shiptopay',$orderInfo['uid'],['order_id' => $orderInfo['id']]);
        return $this->jsuccess('处理成功');
    }

    /**
     * 确定发货
     */
    public function doship()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $id = input('id', '');
        $postCode = input('post_code', 0);
        if (intval($id) <= 0 || empty($postCode)) {
            return $this->jerror('请输入完整信息');
        }
        $orderInfo = Db::name('shipment_orders')
            ->where('id', intval($id))
            ->find();
        if (!$orderInfo) {
            return $this->jerror('该出库申请不存在');
        }

        if ($orderInfo['is_pay'] != 1 || $orderInfo['status'] != 2) {
            return $this->jerror('该出库申请还未支付');
        }

        $data = [
            'postcode' => $postCode,
            'status' => 3,
            'last_update_mid' => $this->admin['uid']
        ];

        Db::startTrans();
        try {
            $res = Db::name('shipment_orders')
                ->where('id', intval($id))
                ->where('status', 2)
                ->save($data);

            if (!$res) {
                Db::rollback();
                return $this->jerror('处理失败');
            }

            $orderList = Db::name('orders')
                ->where('id', 'in', explode(',', $orderInfo['orderids']))
                ->field('id,out_trade_no,goods_name,cover,weight,store_area,ext_goods_no')
                ->select()->toArray();

            $res = Db::name('orders')
                ->where('id', 'in', explode(',', $orderInfo['orderids']))
                ->save(['status' => 5,'doship_post_time' => time(), 'update_time' => time(), 'last_update_mid' => $this->admin['uid']]);
            if (!$res) {
                Db::rollback();
                return $this->jerror('处理失败');
            }

            foreach ($orderList as $order) {
                $res = OrderModel::addLog(0, $this->admin['uid'], $order['id'], '发货已出库', '');
                if (!$res) {
                    Db::rollback();
                    return $this->jerror('处理失败');
                }
            }

            Db::commit();

            //-- 公众号提醒
            MnpAlertLogic::addAlertMsg('shipgo',$orderInfo['uid'],['order_id' => $orderInfo['id']]);
            return $this->jsuccess('处理成功');
        }
        catch (\Excetion $e) {
            Db::rollback();
            return $this->jerror('处理失败');
        }


    }


    /**
     * 打印任务列表
     *  将缓存的待打印信息给前台
     */
    public function printTasks()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $order = Printer::popQueue($this->admin['uid']);
        if ($order) {
            return $this->jsuccess('ok', $order);
        }
        return $this->jerror('暂时');
    }




    /**
     * 拍照订单
     * @return \think\response\Json|\think\response\View
     */
    public function photos()
    {
        $where = [['o.is_pay', '=', 1]];
        $status = input('status',0);
        if(intval($status) > 0){
            $where[] = ['o.photo','=',intval($status)];
        }else{
            $where[] = ['o.photo','>',0];
        }
        return $this->orderlist($where);
    }

    /**
     * 提交拍照图片
     */
    public function addPhotos(){
        if(!$this->request->isPost()){
            $id = input('id',0);
            $pictureList = Db::name('order_photos')
                ->where('order_id',intval($id))
                ->column('uri');
            return $this->jsuccess('ok',$pictureList);
        }
        $id = input('id',0);
        $pictures = input('pictures','');
        if(intval($id) <=0){
            return $this->jerror('参数错误');
        }
        if(empty($pictures)){
            return $this->jerror('图片不能为空');
        }
        $pictureArr = explode(',',$pictures);
        $model = new OrderModel();
        $orderInfo = $model
            ->where('id',intval($id))
            ->find();
        if(!$orderInfo || $orderInfo['photo'] <=0){
            return $this->jerror('该订单没有选择拍照服务');
        }

        $model->startTrans();
        try {
            $res = $orderInfo->save(['photo' => 2]);
            if(!$res){
                throw new \Exception('修改状态失败');
            }

            $res = Db::name('order_photos')
                ->where('order_id',$orderInfo['id'])
                ->delete();
            if($res === false){
                throw new \Exception('清理老照片失败');
            }

            $dataList = [];
            foreach ($pictureArr as $picture){
                $dataList[] = [
                    'order_id' => $orderInfo['id'],
                    'uri' => $picture,
                    'create_time' => time()
                ];
            }

            $res = Db::name('order_photos')
                ->insertAll($dataList);
            if(!$res){
                throw new \Exception('照片保存失败');
            }

            $model->commit();
            return $this->jsuccess('照片保存成功');

        }catch (\Exception $e){
            $model->rollback();
            return $this->jerror($e->getMessage());
        }

    }
}