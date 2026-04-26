<?php
/**
 * Created by PhpStorm.
 * Date: 2021/8/29
 * Time: 21:53
 * description:
 */

namespace app\common\model;

use app\common\library\H5Alipay;
use app\common\library\PayClound;
use app\common\library\WechatApp;
use app\common\library\Wecom;
use app\common\library\Wepay;
use app\common\logic\MnpAlertLogic;
use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\facade\Db;
use think\helper\Str;
use think\Model;
use think\Validate;

class ShipOrders extends Model
{
    protected $table = 'st_shipment_orders';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public $rules = [
        'orderids|订单信息' => 'require',
        'uid|用户' => 'require',
    ];
    /**
     * 错误提示
     * @var array
     */
    public $errMsg = [];

    /**
     * 订单状态
     * @param bool $status
     * @return array|mixed
     */
    public static function getStatusArr($status = false)
    {
        $arr = [
            '-1' => '已取消',
            '0' => '未确认',
            '1' => '已确认',
            '2' => '已支付',
            '3' => '已发出',
            '4' => '退款中',
            '5' => '已退款',
            '6' => '已完成',
        ];
        if ($status === false) {
            return $arr;
        }
        return $arr[$status];
    }

    public static function payWay($way = false)
    {
        $arr = [
            'alipay_offline' => '支付宝线下支付',
            'wepay_offline' => '微信线下支付',
            'taobao' => '淘宝支付',
            'alipay' => '支付宝线上支付',
            'wepay' => '微信线上支付'
        ];
        if ($way === false) {
            return $arr;
        }
        return $arr[$way];
    }

    public function editRow($params)
    {
        $data = [];
        try {
            \validate($this->rules, $this->errMsg)->failException(true)->check($params);
            $allowField = [
                'uid',
                'orderids',
                'realname',
                'country',
                'mobile',
                'province',
                'city',
                'address',
                'area',
                'postno',
                'post_picture',
                'store_remark',
                'value_added',
                'remark',
                'weight',
                'post_fee',
                'pack_fee',
                'after_post_fee',
                'over_time_fee',
                'goods_list',
                'split_boxs',
                'ship_way',
                'postcode',
            ];
            $data = filter_data($params, $allowField);

            $adminInfo = Members::_isLogin();
            if (!$adminInfo) {
                return [1, '你没有权限编辑'];
            }

            $id = isset($params['id']) ? intval($params['id']) : 0;
            if (intval($id) <= 0) {
                return [1, '请选择要编辑的出库订单'];
            }

            $info = $this->where('id', $id)->where('uid', $data['uid'])->find();
            if (!$info) {
                return [1, '该出库订单不存在'];
            }

//            if (in_array($info['status'], [-1,3]) && $adminInfo['rid'] != 0) {
//                return [1, '不允许修改'];
//            }
//

            //-- 填写了邮费，则认为是已确认
            if($info['status'] == 0 && $data['post_fee'] > 0 && isset($params['action_type']) && $params['action_type'] == 1){
                $data['status'] = 1;
            }

            //-- 处理分箱数据
            $splitBoxs = [];
            if(!empty($data['split_boxs'])){
                $splitBoxs = json_decode($data['split_boxs'],true);
                foreach ($splitBoxs as &$bitem){
                    if(empty($bitem['ship_post_no']) || empty($bitem['order_amount']) || empty($bitem['ship_amount']) || empty($bitem['order_amount_rmb']) || empty($bitem['ship_amount_rmb'])){
                        return [1,'请输入分箱数据'];
                    }
                    if(empty($bitem['orderids'])){
                        return [1,'分箱数据错误'];
                    }
                    if(empty($bitem['out_trade_no'])){
                        $bitem['out_trade_no'] = $this->getTradeNo();
                    }
                }
                $data['split_boxs'] = json_encode($splitBoxs);
            }

            if ($info['is_pay'] == 1) {

                Db::startTrans();
                try{
                    //-- 已支付的情况，只能编辑物流信息
                    $allowField = [
                        'remark',
                        'ship_way',
                        'postcode',
                        'split_boxs',
                        'post_picture',
                        'store_remark'
                    ];
                    $data = filter_data($params, $allowField);
                    $data['update_time'] = time();
                    $data['last_update_mid'] = $adminInfo['uid'];

                    if(!empty($data['postcode']) && $info['status'] < 3 && isset($params['action_type']) && $params['action_type'] == 1){
                        $data['status'] = 3;
                    }

                    $res = $info->save($data);
                    if (!$res) {
                        Db::rollback();
                        return [1, '操作失败请稍后再试,Err0'];

                    }

                    //-- 将分箱数据物流单号更新到订单数据
                    $boxRes = Db::name('orders')
                        ->where('id', 'in',explode(',',$info['orderids']))
                        ->where('uid', intval($info['uid']))
                        ->update(['ship_post_code' => '','update_time' => time()]);
                    if(!$boxRes){
                        Db::rollback();
                        return [1, '操作分箱失败请稍后再试,Err01'];
                    }

                    foreach($splitBoxs as $box){
                        $boxRes = Db::name('orders')
                            ->where('id', 'in',$box['orderids'])
                            ->where('uid', intval($info['uid']))
                            ->update(['ship_post_code' => $box['ship_post_no'],'update_time' => time()]);
                        if(!$boxRes){
                            Db::rollback();
                            return [1, '操作分箱失败请稍后再试,Err02'.json_encode($box)];
                        }
                    }

                    //-- 如果已经发出，则将关联的订单修改
                    if(isset($data['status']) && $data['status'] == 3){

                        $idArr = explode(',',$info['orderids']);
                        $updateData = ['status' => 5,'doship_post_time' => time(), 'update_time' => time(), 'ship_order_id' => $info['id'], 'last_update_mid' => $adminInfo['uid']];
                        $res = Db::name('orders')
                            ->where('id', 'in',explode(',',$info['orderids']))
                            ->where('uid', intval($info['uid']))
                            ->save($updateData);

                        if (!$res) {
                            Db::rollback();
                            return [1, '操作失败请稍后再试,Err4'];
                        }
                        foreach ($idArr as $id2) {
                            OrderModel::addLog(0, $adminInfo['uid'], $id2, '订单已经出库', json_encode($data, JSON_UNESCAPED_UNICODE));
                        }


                    }

                    Db::commit();

                    return [0, '编辑成功'];

                }catch (\Exception $e){
                    Db::rollback();
                    return [1, '编辑失败'.$e->getMessage()];
                }

            }

            $idArr = explode(',', $data['orderids']);
            if (empty($idArr)) {
                return [1, '请选择要出库的订单'];
            }

            $rate = \think\facade\Config::get('config.SHIP_EXCHANGE_RATE');
            $realrate = \think\facade\Config::get('config.EXCHANGE_RATE');
            $userInfo = Db::name('users')
                ->alias('u')
                ->where('u.id', $data['uid'])
                ->field('u.*,l.name as level_name,l.ship_rate,l.over_time_fee,l.store_days')
                ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
                ->find();
            if (!$userInfo) {
                return ['该用户不存在'];
            }

            //-- 计算价格
            $orderList = Db::name('orders')
                ->where('uid', $data['uid'])
                ->where('id', 'in', $idArr)
                ->where('status', 'in', [3, 4])
                ->select()->toArray();

            if (!$orderList || count($orderList) != count($idArr)) {
                Db::name('debug_logs')->insert(['content' => json_encode($data)]);
                return [1, '选择的订单异常'];
            }

            foreach ($orderList as $item) {
                if ($item['status'] == 4 && $item['ship_order_id'] != $id) {
                    return [1, '选择的订单异常'];
                }
            }

            $rate = floatval($rate) + floatval($userInfo['ship_rate']);
            //-- 如果提交时填写了，则不用自动计算
            $data['after_post_fee'] = floatval($data['after_post_fee']) >0?floatval($data['after_post_fee']):array_sum(array_column($orderList, 'after_post_fee'));
            $overTimeFee = 0;
            //-- 计算过期费用
            $jsonList = [];
            foreach ($orderList as $item) {
                $days = intval((time() - $item['store_time']) / 86400);
                if ($days > $userInfo['store_days']) {
                    $overTimeFee += ($days - $userInfo['store_days']);
                }
                $jsonList[] = [
                    'id' => $item['id'],
                    'out_trade_no' => $item['out_trade_no'],
                    'goods_name' => $item['goods_name'],
                    'cover' => $item['cover'],
                    'amount' => $item['amount'],
                    'amount_rmb' => $item['amount_rmb'],
                    'price' => $item['price'],
                    'weight' => $item['weight'],
                    'post_fee' => $item['post_fee'],
                    'fee' => $item['fee']
                ];
                //-- 如果提交时填写了，则不用自动计算
                $data['over_time_fee'] = floatval($data['over_time_fee'])>0?floatval($data['over_time_fee']):$overTimeFee;
            }

            //-- 计算增值服务
            if(!empty($data['value_added'])){
                $valueArr = explode(',',$data['value_added']);
                $valueList = Db::name('value_added')
                    ->where('id','in',$valueArr)
                    ->column('price');
                if(count($valueList) != count($valueArr)){
                    return [1,'选择的增值服务异常'];
                }
            }


            $amount = round(floatval($data['post_fee']) +floatval($data['pack_fee']) + floatval($data['after_post_fee']) + floatval($data['over_time_fee']), 2);
            $amountRmb = round($amount * $rate, 2);
            $amountRmb = ceil($amountRmb);

            $data['amount'] = $amount;
            $data['amount_rmb'] = $amountRmb;
            $data['rate'] = $rate;
            $data['realrate'] = $realrate;
            $data['order_json'] = json_encode($jsonList,JSON_UNESCAPED_UNICODE);

        }
        catch (ValidateException $e) {
            return [1, $e->getMessage()];
        }
        catch (Exception $e) {
            return [1, $e->getMessage()];
        }


        //-- 编辑订单资料
        Db::startTrans();
        try {
            if ($info['orderids'] != $data['orderids']) {
                $oldIdArr = explode(',', $info['orderids']);
                $idArr = explode(',', $data['orderids']);

                foreach ($oldIdArr as $id1) {
                    if (!in_array($id, $idArr)) {
                        //-- 恢复到入库状态
                        $updateData = ['status' => 3,'ship_post_code' => '', 'update_time' => time(), 'ship_time' => 0, 'ship_order_id' => 0, 'last_update_mid' => $adminInfo['uid']];
                        $res = OrderModel::addLog(0, $adminInfo['uid'], $id1, '将订单恢复到入库状态', json_encode($data, JSON_UNESCAPED_UNICODE));
                        $res2 = Db::name('orders')
                            ->where('id', $id1)
                            ->where('status', 4)
                            ->where('uid', intval($data['uid']))
                            ->save($updateData);
                        if (!$res || !$res2) {
                            Db::rollback();
                            return [1, '操作失败请稍后再试,Err1'];
                        }
                    }
                }

                //-- 将新的订单修改状态
                foreach ($idArr as $id2) {
                    if (!in_array($id, $oldIdArr)) {
                        $updateData = ['status' => 4,'ship_post_code' => '', 'update_time' => time(), 'ship_time' => time(), 'ship_order_id' => $info['id'], 'last_update_mid' => $adminInfo['uid']];
                        $res = OrderModel::addLog(0, $adminInfo['uid'], $id2, '将订单申请出库', json_encode($data, JSON_UNESCAPED_UNICODE));
                        $res2 = Db::name('orders')
                            ->where('id', $id2)
                            ->where('status', 3)
                            ->where('uid', intval($data['uid']))
                            ->save($updateData);
                        if (!$res || !$res2) {
                            Db::rollback();
                            return [1, '操作失败请稍后再试,Err2'];
                        }
                    }
                }

            }

            //-- 先把
            $data['last_update_mid'] = $adminInfo['uid'];
            $data['update_time'] = time();
            $res = $info->save($data);
            if (!$res) {
                Db::rollback();
                return [1, '操作失败请稍后再试,Err3'];
            }

            //-- 将分箱数据物流单号更新到订单数据
//            $boxRes = Db::name('orders')
//                ->where('id', 'in',explode(',',$info['orderids']))
//                ->where('uid', intval($info['uid']))
//                ->update(['ship_post_code' => '','update_time' => time()]);
//            if(!$boxRes){
//                Db::rollback();
//                return [1, '操作分箱失败请稍后再试,Err01'];
//            }

            foreach($splitBoxs as $box){
                $boxRes = Db::name('orders')
                    ->where('id', 'in',$box['orderids'])
                    ->where('uid', intval($info['uid']))
                    ->update(['ship_post_code' => $box['ship_post_no'],'update_time' => time()]);
                if(!$boxRes){
                    Db::rollback();
                    return [1, '操作分箱失败请稍后再试,Err02'];
                }
            }

            if(isset($data['status']) && $data['status'] == 1){
                //-- 发送消息
                Wecom::addAlertMsg('confirm_ship_order',$info['id']);
            }

            if($data['amount'] > 0 && $info['is_pay'] != 1){
                //-- 公众号提醒
                MnpAlertLogic::addAlertMsg('shiptopay',$info['uid'],['order_id' => $info['id']]);
            }


            Db::commit();
            return [0, '操作成功'];
        }
        catch (\Exception $e) {
            Db::rollback();
            return [1, '操作失败请稍后再试,Err5'.$e->getMessage()];
        }
    }


    /**
     * 新建入库订单
     * @param $params
     * @return array
     */
    public function addRow($params)
    {
        $data = [];
        try {
            \validate($this->rules, $this->errMsg)->failException(true)->check($params);
            $allowField = [
                'uid',
                'orderids',
                'realname',
                'country',
                'mobile',
                'province',
                'city',
                'address',
                'area',
                'postno',
                'store_remark',
                'value_added',
                'remark',
                'goods_list',
                'ship_way'
            ];
            $adminInfo = Members::_isLogin();
            //-- 管理员编辑的情况
            if ($adminInfo) {
                $allowField = array_merge($allowField, ['weight', 'post_fee','pack_fee','split_boxs', 'ship_way', 'postcode','post_picture','store_remark']);
            }
            $data = filter_data($params, $allowField);

            $idArr = explode(',', $data['orderids']);
            if (empty($idArr)) {
                return [1, '请选择要出库的订单'];
            }

            $rate = \think\facade\Config::get('config.SHIP_EXCHANGE_RATE');
            $realrate = \think\facade\Config::get('config.EXCHANGE_RATE');
//            $realrate = $rate;
            $userInfo = Db::name('users')
                ->alias('u')
                ->where('u.id', $data['uid'])
                ->field('u.*,l.name as level_name,l.ship_rate,l.over_time_fee,l.store_days')
                ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
                ->find();
            if (!$userInfo) {
                return [1,'该用户不存在'];
            }

            //-- 计算价格
            $orderList = Db::name('orders')
                ->where('uid', $data['uid'])
                ->where('id', 'in', $idArr)
                ->where('status', 3)
                ->select()->toArray();

            if (!$orderList || count($orderList) != count($idArr)) {
                return [1, '选择的订单异常'];
            }

            $rate = floatval($rate) + floatval($userInfo['ship_rate']);
            $afterPostFee = 0;
            $overTimeFee = 0;
            //-- 计算过期费用
            $jsonList = [];
            foreach ($orderList as $item) {
                $afterPostFee += ($item['after_post_rate'] <= 0?$item['after_post_fee']:(($item['after_post_fee']*$item['after_post_rate'])/$rate));

                $days = intval((time() - $item['store_time']) / 86400);
                if ($days > $userInfo['store_days']) {
                    $overTimeFee += ($days - $userInfo['store_days']) * $userInfo['over_time_fee'];
                }
                $jsonList[] = [
                    'id' => $item['id'],
                    'out_trade_no' => $item['out_trade_no'],
                    'goods_name' => $item['goods_name'],
                    'cover' => $item['cover'],
                    'amount' => $item['amount'],
                    'amount_rmb' => $item['amount_rmb'],
                    'price' => $item['price'],
                    'weight' => $item['weight'],
                    'store_area' => $item['store_area'],
                    'post_fee' => $item['post_fee'],
                    'fee' => $item['fee']
                ];
            }

            //-- 计算增值服务
            if(!empty($data['value_added'])){
                $valueArr = explode(',',$data['value_added']);
                $valueList = Db::name('value_added')
                    ->where('id','in',$valueArr)
                    ->column('price');
                if(count($valueList) != count($valueArr)){
                    return [1,'选择的增值服务异常'];
                }

                if(!$adminInfo){
                    $data['pack_fee'] = array_sum($valueList);
                }
            }

            //-- 处理分箱数据
            $splitBoxs = [];
            if(!empty($data['split_boxs'])){
                $splitBoxs = json_decode($data['split_boxs'],true);
                foreach ($splitBoxs as &$item){
                    if(empty($item['ship_post_no']) || empty($item['order_amount']) || empty($item['ship_amount']) || empty($item['order_amount_rmb']) || empty($item['ship_amount_rmb'])){
                        return [1,'请输入分箱数据'];
                    }
                    if(empty($item['orderids'])){
                        return [1,'分箱数据错误'];
                    }
                    if(empty($item['out_trade_no'])){
                        $item['out_trade_no'] = $this->getTradeNo();
                    }
                }
                $data['split_boxs'] = json_encode($splitBoxs);
            }

            $data['after_post_fee'] = intval($afterPostFee);
            $data['over_time_fee'] = $overTimeFee;

            if ($adminInfo) {
                $amount = round(floatval($data['post_fee']) + $afterPostFee + $overTimeFee, 2);
                $amountRmb = round($amount * $rate, 2);
                $data['amount'] = $amount;
                $data['amount_rmb'] = $amountRmb;
            }

            $data['order_json'] = json_encode($jsonList,JSON_UNESCAPED_UNICODE);
        }
        catch (ValidateException $e) {
            return [1, $e->getMessage()];
        }
        catch (Exception $e) {
            return [1, $e->getMessage()];
        }
        //-- 新入库的情况
        $data['create_time'] = time();
        $data['create_mid'] = $adminInfo ? $adminInfo['uid'] : 0;
        $data['out_trade_no'] = $this->getTradeNo();
        $data['realrate'] = $realrate;
        Db::startTrans();
        try {
            $orderId = $this
                ->insert($data, true);
            if (!$orderId) {
                Db::rollback();
                return [1, '新建订单失败err.2'];
            }
            foreach ($idArr as $oid) {
                $res = OrderModel::addLog($adminInfo ? 0 : $data['uid'], $adminInfo ? $adminInfo['uid'] : 0, $oid, '对订单出库做了出库处理', json_encode($data, JSON_UNESCAPED_UNICODE));
                if (!$res) {
                    Db::rollback();
                    return [1, '新建订单失败err.3'];
                }
            }

            //-- 修改道具状态
            $updateData = ['status' => 4, 'ship_order_id' => $orderId, 'ship_time' => time(), 'update_time' => time()];
            $res = Db::name('orders')
                ->where('id', 'in', $idArr)
                ->where('uid', intval($data['uid']))
                ->save($updateData);
            if (!$res) {
                Db::rollback();
                return [1, '新建订单失败err.4'];
            }

            //-- 将分箱数据物流单号更新到订单数据
            foreach($splitBoxs as $box){
                $boxRes = Db::name('orders')
                    ->where('id', 'in',$box['orderids'])
                    ->where('uid', intval($data['uid']))
                    ->update(['ship_post_code' => $box['ship_post_no'],'update_time' => time()]);
                if(!$boxRes){
                    Db::rollback();
                    return [1, '操作分箱失败请稍后再试,Err02'];
                }
            }

            if(!$adminInfo){
                Wecom::addAlertMsg('shipment',$orderId);
            }

            Db::commit();
            if(isset($data['amount']) && $data['amount'] > 0){
                //-- 公众号提醒
                MnpAlertLogic::addAlertMsg('shiptopay',$data['uid'],['order_id' => $orderId]);
            }

            return [0, '操作成功'];
        }
        catch (\Exception $e) {
            Db::rollback();
            Db::name('debug_logs')->insert(['content' => '新建订单失败err.5'.$e->getMessage()]);
            return [1, '新建订单失败err.5'];
        }
    }

    /**
     * 订单支付记录
     * @param $outTradeNos
     * @param $orders
     * @param $totalFee
     * @param $tradeNo
     * @param $payWay
     * @param $remark
     * @param int $mid
     * @return int|string
     */
    public static function addPayLog($outTradeNos, $orders, $totalFee, $tradeNo, $payWay, $remark, $mid = 0, $uid = 0)
    {
        $data = [
            'out_trade_nos' => $outTradeNos,
            'orders' => $orders,
            'total_fee' => $totalFee,
            'trade_no' => $tradeNo,
            'pay_way' => $payWay,
            'remark' => $remark,
            'uid' => 0,
            'create_mid' => $mid,
            'create_time' => time()
        ];
        return Db::name('pay_logs')->insert($data);
    }

    private function getTradeNo()
    {
        return date('Ymdhis', time()) . Str::random(6, 1);
    }

    /**
     * 取消出库
     */
    public function cancelShipOrder($id,$uid,$mid=0){

        $map = [['id','=',$id]];
        if($uid >0){
            $map[] = ['uid','=',$uid];
        }

        $orderInfo = $this
            ->where($map)
            ->find();
        if(!$orderInfo){
            return [1,'该订单不存在'];
        }
        if(!in_array($orderInfo['status'],[0]) && $mid <=0){
            return [1,'该订单不能取消，请联系客服'];
        }

        if($orderInfo['status'] == 3){
            return [1,'该状态不能取消'];
        }

        $data = [
            'status' => -1
        ];

        if($orderInfo['is_pay'] > 0){
            $data['refund'] = 0;
            $data['status'] = 4;
        }

        $this->startTrans();
        try{

            $res = $orderInfo->save($data);
            if(!$res){
                throw  new \Exception('取消失败');
            }

            //-- 获取关联的订单
            $orderList = (new OrderModel())
                ->where('ship_order_id',$id)
                ->where('uid',$orderInfo['uid'])
                ->where('status',4)
                ->select();
            foreach ($orderList as $info){
                //-- 加日志
                $res = OrderModel::addLog($mid>0?0:$uid,$mid,$info['id'],'取消了出库','');
                if(!$res){
                    throw  new \Exception('记录日志失败');
                }
            }

            $orderData = ['status' => 3];
            if($mid){
                $orderData['last_update_mid'] = $mid;
            }

            //-- 修改订单状态为入库
            $res = (new OrderModel())
                ->where('ship_order_id',$id)
                ->where('uid',$orderInfo['uid'])
                ->where('status',4)
                ->save($orderData);
            if(!$res){
                throw  new \Exception('取消失败');
            }


            $this->commit();

            if(isset($data['refund'])){
                //$this->doRefund($orderInfo);
            }

            MnpAlertLogic::addAlertMsg('cancelorder',$orderInfo['uid'],['type' => 2,'order_id' => $orderInfo['id'],'amount' => $orderInfo['amount_rmb'],'order_sn' => $orderInfo['out_trade_no']]);
            return [0,'取消成功'];

        }catch (\Exception $e){
            $this->rollback();
            return [1,$e->getMessage()];
        }
    }

    public function handleRefund($id,$status,$mid=0)
    {
        $orderInfo = (new ShipOrders())
            ->where('id', intval($id))
            ->find();

        if(!$orderInfo){
           return [1,'该订单不存在'];
        }

        if($orderInfo['refund_status'] != 1){
            return [1,'该订单已经处理过了'];
        }

        if($status != 2){
            $res = $orderInfo->save(['refund_status' => 3,'last_update_mid' => $mid]);
            self::addShipLog($orderInfo['id'],'操作了取消退款操作');
            if($res){
                return [0,'操作成功'];
            }else{
                return [1,'操作失败'];
            }
        }


        $this->startTrans();
        try {
            $res = $orderInfo->save(['refund_status' => 2,'last_update_mid' => $mid]);
            if (!$res) {
                throw  new \Exception('取消失败');
            }
            //-- 加日志
            $res = self::addShipLog($orderInfo['id'],'操作了确认退款操作');
            if (!$res) {
                throw  new \Exception('记录日志失败');
            }

            $payInfo = Db::name('pay_logs')
                ->where('trade_no', $orderInfo['trade_no'])
                ->where('status', 1)
                ->find();
            if (!$payInfo) {
                throw  new \Exception('没有找到支付记录');
            }

            $res = Db::name('refund_logs')
                ->where('order_id', $orderInfo['id'])
                ->where('type','ship')
                ->find();
            if ($res) {
                throw  new \Exception('该订单貌似已退款');
            }

            $data = [
                'trade_no' => $payInfo['trade_no'],
                'out_trade_no' => $orderInfo['out_trade_no'],
                'refund_amount' => $orderInfo['refund_amount'],
                'order_id' => $orderInfo['id'],
                'goods_name' => '退差价',
                'refund_trade_no' => $this->getTradeNo(),
                'uid' => $orderInfo['uid'],
                'total_pay_amount' => $payInfo['actual_pay'],
                'type' => 'ship',
                'create_time' => time()
            ];
            $refundId = Db::name('refund_logs')
                ->insert($data, true);
            if (!$refundId) {
                throw  new \Exception('插入退款记录失败');
            }

            if (in_array($orderInfo['pay_way'], ['wepay', 'alipay','payclound'])) {
                list($err, $msg) = $this->doRefund($orderInfo, $payInfo, $refundId, $data['refund_trade_no'], $orderInfo['refund_amount']);
                if ($err != 0) {
                    throw new \Exception($msg);
                }
            }

            $this->commit();
            return [0, '取消成功'];
        } catch (\Exception $e) {
            $this->rollback();
            return [1, $e->getMessage()];
        }

    }

    /**
     * 处理退款
     */
    public function doRefund($orderInfo, $payInfo, $refundId, $refund_trade_no, $refundAmount)
    {
        if (!in_array($orderInfo['pay_way'], ['wepay', 'alipay','payclound'])) {
//        if (!in_array($orderInfo['pay_way'], ['wepay', 'alipay'])) {
            return [0, '线下退款'];
        }
        if ($orderInfo['actual_pay'] <= 0) {
            //return [1, '没检测到实际支付金额'];
        }

        try {
            if ($orderInfo['pay_way'] == 'wepay') {
                $config = config('app.wepay');
                $api = new Wepay($config);
                list($err, $result) = $api->refund(['transaction_id' => $payInfo['trade_no'], 'refund_fee' => floatval($refundAmount) * 100, 'total_fee' => $payInfo['actual_pay'] * 100, 'out_refund_no' => $refund_trade_no]);
            }else if ($orderInfo['pay_way'] == 'payclound') {
                $pay = new PayClound();
//                $rate = $this->getPayRate($orderInfo['out_trade_no']);
//                if($rate <=0){
//                    return [1,'微信支付未配置'];
//                }
//                $amount = intval(floatval($refundAmount)/floatval($rate));
                list($err, $result) = $pay->refund($payInfo['trade_no'],$refund_trade_no,$refundAmount);
            } else {
                $config = config('app.alipay');
                $api = new H5Alipay($config);
                list($err, $result) = $api->refund($payInfo['trade_no'], $refundAmount, $refund_trade_no);
            }
            if ($err != 0) {
                return [1, $result];
            }
            Db::name('refund_logs')
                ->where('id', $refundId)
                ->save(['extras' => json_encode($result, JSON_UNESCAPED_UNICODE)]);
            return [0, '退款成功'];

        } catch (\Exception $e) {
            return [1, $e->getMessage()];
        }
    }

        /**
     * 确认收货
     */
    public function doneShipOrder($id,$uid,$mid=0){

        $map = [['id','=',$id]];
        if($uid >0){
            $map[] = ['uid','=',$uid];
        }

        $orderInfo = $this
            ->where($map)
            ->find();
        if(!$orderInfo){
            return [1,'该订单不存在'];
        }
        if($orderInfo['status'] != 3){
            return [1,'该订单状态，不能确认收货'];
        }

        $data = [
            'status' => 6
        ];

        $this->startTrans();
        try{

            $res = $orderInfo->save($data);
            if(!$res){
                throw  new \Exception('操作失败');
            }

            //-- 获取关联的订单
            $orderList = (new OrderModel())
                ->where('ship_order_id',$id)
                ->where('uid',$orderInfo['uid'])
                ->where('status',5)
                ->select();
            foreach ($orderList as $info){
                //-- 加日志
                $res = OrderModel::addLog($mid>0?0:$uid,$mid,$info['id'],'确认收货','');
                if(!$res){
                    throw  new \Exception('记录日志失败');
                }
            }

            $this->commit();
            return [0,'操作成功'];
        }catch (\Exception $e){
            $this->rollback();
            return [1,$e->getMessage()];
        }
    }



    /**
     * 发送客服确认订阅消息
     * @param $orderId
     * @return false|void
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public static function sendConfirmMsg($orderId){
        $templateId = 'bcAvJAN7K1ey2TP6uI2pSodGbx1lFqSX4j0PZiU7BWs';
        $orderInfo = Db::name('shipment_orders')
            ->alias('so')
            ->where('so.id',$orderId)
            ->join('st_user_wechat u','u.uid=so.uid and u.type="hwweapp"','LEFT')
            ->field('so.*,u.openid')
            ->find();
        if(!$orderInfo || empty($orderInfo['openid'])){
            return false;
        }
        $orderArr = json_decode($orderInfo['order_json'],true);
        $goodsName = sprintf('%s等%s件商品',$orderArr[0]['goods_name'],count($orderArr));
        $data = [
            'character_string1' =>['value' => $orderInfo['out_trade_no']],
            'thing2' =>['value' => $goodsName],
            'amount3' =>['value' => $orderInfo['amount_rmb']],
            'time4' =>['value' => date('Y/m/d H:i:s',$orderInfo['update_time'])],
            'thing5' =>['value' => '您的出库订单已经确认，请24小时内付款'] // 20个字符以内
        ];
        try {
            $weixin = new WechatApp();
            $weixin->sendMsg($orderInfo['openid'],$templateId,'pages/daishujun/index/index',$data);
            return true;
        }catch (\Exception $e){
            return false;
        }
    }

    public static function addShipLog($orderId,$remark){
        return Db::name('shipment_logs')
            ->insert([
                'order_id' => $orderId,
                'remark' => $remark,
                'create_time' => time()
            ]);
    }
}