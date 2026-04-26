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
use app\common\library\Taobao;
use app\common\library\WechatApp;
use app\common\library\Wecom;
use app\common\library\Wepay;
use app\common\logic\JobQueueLogic;
use app\common\logic\MnpAlertLogic;
use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\facade\Db;
use think\helper\Str;
use think\Model;
use think\Validate;
use Tools\StRedis;

class OrderModel extends Model
{
    protected $table = 'st_orders';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public $rules = [
        'goods_name|商品名称' => 'require',
        'amount|总金额' => 'require',
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
            '0' => '待支付',
            '1' => '待客服确认',
            '2' => '待入库',
            '3' => '已入库',
            '4' => '出库中',
            '5' => '已出库',
            '6' => '申请退款',
            '7' => '已退款'
        ];
        if ($status === false) {
            return $arr;
        }
        return $arr[$status];
    }


    /**
     * 拍照服务状态
     * @param bool $status
     * @return array|mixed
     */
    public static function getPhotoStatusArr($status = false)
    {
        $arr = [
            '0' => '无需拍照',
            '1' => '等待拍照',
            '2' => '已拍照',
            '3' => '已确认',
            '4' => '重新拍照',
        ];
        if ($status === false) {
            return $arr;
        }
        return $arr[$status];
    }

    /**
     * 商城来源
     * @param bool $status
     * @return array|mixed
     */
    public static function getShopArr($shop = false)
    {
        $arr = [
            'mercari' => '煤炉',
            'yahoo' => '雅虎竞拍',
        ];
        $shopList = Db::name('shops')
            ->where('is_deleted', 0)
            ->field('code,name,fee')
            ->select()->toArray();
        foreach ($shopList as $item) {
            $arr[$item['code']] = $item['name'];
        }
        if ($shop === false) {
            return $arr;
        }
        return $arr[$shop];
    }

    public static function payWay($way = false)
    {
        $arr = [
            'alipay_offline' => '支付宝线下支付',
            'wepay_offline' => '微信线下支付',
            'taobao' => '淘宝支付',
            'alipay' => '支付宝线上支付',
            'wepay' => '微信线上支付',
            'payclound' => '海外微信线上支付',
        ];
        if ($way === false) {
            return $arr;
        }
        return $arr[$way];
    }

    /**
     * 新增和编辑
     * @param $params
     * @return array
     */
    public function addRow($params)
    {
        try {
            \validate($this->rules, $this->errMsg)->failException(true)->check($params);
            $allowField = [
                'uid',
                'shop',
                'cat',
                'goods_id',
                'goods_name',
                'ext_goods_no',
                'cover',
                'seller',
                'seller_id',
                'seller_address',
                'amount',
                'postcode',
                'price',
                'fee',
                'level_fee',
                'post_fee',
                'photo_fee',
                'quantity',
                'user_remark',
                'remark',
                'is_pay',
                'goods_url',
                'invoice_status',
                'value_added_fee',
                'value_added',
                'value_added_names',
            ];
            $data = filter_data($params, $allowField);
            $realRate = \think\facade\Config::get('config.EXCHANGE_RATE');
            $userInfo = Db::name('users')
                ->alias('u')
                ->where('u.id', $data['uid'])
                ->field('u.*,l.name as level_name,l.fee as level_fee,l.rate as level_rate')
                ->join('st_user_levels l', 'l.id=u.level', 'LEFT')
                ->find();
            if (!$userInfo) {
                return ['该用户不存在'];
            }

            //附加服务
            $valueIdArr = isset($data['value_added'])?explode(',',$data['value_added']):[];
            //拍照服务 或者 错发漏发服务，都要拍照
            $data['photo'] = (in_array(6,$valueIdArr) || in_array(5,$valueIdArr))?1:0;


            $rate = floatval($realRate) + floatval($userInfo['level_rate']);
            $adminInfo = Members::_isLogin();

            $id = isset($params['id']) ? intval($params['id']) : 0;
            $data['update_time'] = time();
            if ($id > 0) {
                if (!$adminInfo) {
                    return [1, '你没有编辑权限'];
                }
                $data['last_update_mid'] = $adminInfo['uid'];
                $info = $this->where(['id' => $id])->find();
                if (!$info) {
                    return [1, '该记录不存在'];
                }

                if($info['photo'] > 1){
                    $data['photo'] = $info['photo'];
                }

                if ($data['amount'] && $info['amount'] != $data['amount']) {
                    //-- 使用锁定录入的时费率
                    $rate = $info['rate']>0?$info['rate']:$rate;
                    $data['amount_rmb'] = ceil(round($rate * $data['amount'],3));
                }

                if (!in_array($info['cat'], explode(',', $adminInfo['order_cats']))) {
                    return [1, '你没有修改权限'];
                }

                //-- 待确认的订单，只要输入了日本的快递号，就会自动变为待入库状态
                if ($info['status'] == 1 && $info['is_pay'] == 1 && !empty($data['postcode'])) {
                    $data['status'] = 2;
                }


                $forceEdit = check_path('orders/forceEdit');
                if (intval($forceEdit) != 1) {
                    //-- 没有超级编辑权限
                    if ($info['status'] == 3) {
                        //-- 入库时只能编辑入库资料
                        $storeAuth = check_path('orders/editstore');
                        if (intval($storeAuth) != 1) {
                            return [1, '你没有编辑入库订单权限'];
                        }
                        $allowField = [
                            'weight',
                            'after_post_fee',
                            'store_area'
                        ];
                        $data = filter_data($params, $allowField);
                        if (floatval($data['weight']) <= 0) {
                            return [1, '订单重量不能为空'];
                        }

                    } else if (in_array($info['status'], [0, 1])) {
                        //-- 编辑基本资料权限

                        $infoAuth = check_path('orders/editinfo');
                        if (intval($infoAuth) != 1) {
                            return [1, '你没有编辑订单资料权限'];
                        }

                    } else {
                        return [1, '该状态订单不允许编辑'];
                    }
                } else {

                    //-- 这是超级编辑权限，啥都能编辑

                    if ($info['status'] >= 2) {
                        $storeField = [
                            'weight',
                            'after_post_fee',
                            'store_area',
                            'remark',
                            'store_remark'
                        ];
                        $storeData = filter_data($params, $storeField);
                        if (floatval($storeData['weight']) <= 0 && $info['status'] == 3) {
                            return [1, '订单重量不能为空'];
                        }
                        $data = array_merge($data, $storeData);
                    }

                }

                unset($data['is_pay']);


                $res = $info->save($data);
                if ($res !== false) {
                    OrderModel::addLog(0, $adminInfo['uid'], $info['id'], '对订单进行了编辑', json_encode($data, JSON_UNESCAPED_UNICODE));
                    return [0, '操作成功'];
                }
                return [1, '操作失败请稍后再试'];
            } else {

                if ($data['shop'] == 'mercari' || $data['shop'] == 'yahoo') {
                    $count = $this
                        ->where('shop', $data['shop'])
                        ->where('ext_goods_no', $data['ext_goods_no'])
                        ->whereNotIn('status', [-1, 6, 7])
                        ->count();
                    if (intval($count) > 0) {
                        return [1, '该商品订单已经存在'];
                    }
                }

                $data['create_time'] = time();
                $data['rate'] = $rate;
                $data['realrate'] = $realRate;
                $data['amount_rmb'] = ceil(round($rate * $data['amount'],2));
                $data['create_mid'] = $adminInfo ? $adminInfo['uid'] : 0;
                $data['out_trade_no'] = $this->getTradeNo();

                Db::startTrans();
                try {
                    $isAutoBuy = isset($params['is_auto_buy'])?intval($params['is_auto_buy']):0;
                    if($data['shop'] != 'mercari'){
                        $isAutoBuy = 0;
                    }
                    $data['is_auto_buy'] = $isAutoBuy==1?1:0;
                    $payAuth = check_path('orders/dopay');
                    //-- 判断是否有支付权限
                    if (intval($payAuth) == 1 && isset($params['is_pay']) && intval($params['is_pay']) > 0) {
                        $data['is_pay'] = 1;
                        $data['pay_way'] = $params['payway'];
                        $data['status'] = $isAutoBuy==1?1:2;
                        $data['actual_pay'] = $data['amount_rmb'];
                        $data['trade_no'] = $adminInfo['uid'] . date('Ymdhis', time());
                        if(in_array($params['payway'],['wepay','alipay'])){
                            throw new \Exception('后台支付不能选择线上支付方式');
                        }
                        if($params['payway'] == 'taobao'){
                            //-- 淘宝支付
                            $taobaoNo = $params['taobao_no'];
                            if(empty($taobaoNo)){
                                throw new \Exception('请输入淘宝订单号');
                            }

                            list($err,$payResult) = PayLogs::checkTaobao($taobaoNo,$data['amount_rmb']);

                            if($err !=0){
                                throw new \Exception($payResult);
                            }
                            $data['trade_no'] = $taobaoNo;
                        }

                    }
                    $orderId = $this
                        ->insert($data, true);
                    if (!$orderId) {
                        Db::rollback();
                        return [1, '新建订单失败'];
                    }
                    $res = OrderModel::addLog($adminInfo ? 0 : $data['uid'], $adminInfo ? $adminInfo['uid'] : 0, $orderId, '创建了订单', json_encode($data, JSON_UNESCAPED_UNICODE));
                    if (!$res) {
                        Db::rollback();
                        return [1, '创建订单日志失败'];
                    }

                    if ($data['is_pay'] == 1) {
                        $res = OrderModel::addPayLog($data['out_trade_no'], $orderId, $data['actual_pay'], $data['trade_no'], $data['pay_way'], '后台订单支付', $adminInfo['uid']);
                        if (!$res) {
                            Db::rollback();
                            return [1, '创建支付记录失败'];
                        }

                        $res = OrderModel::addLog($adminInfo ? 0 : $data['uid'], $adminInfo ? $adminInfo['uid'] : 0, $orderId, '支付了订单', json_encode($data, JSON_UNESCAPED_UNICODE));
                        if (!$res) {
                            Db::rollback();
                            return [1, '创建订单支付日志失败'];
                        }
                    }

                    if($adminInfo){
                        //-- 发送消息
                        Wecom::addAlertMsg('confirm_order',$orderId);
                        MnpAlertLogic::addAlertMsg('goodstopay',$data['uid'],['order_id' => $orderId]);
                    }


                    Db::commit();
                    //检测连续购买
                    if($data['is_pay'] > 0){
                        JobQueueLogic::addQueue('lxbuycoupon',['order_id' => $orderId,'uid' => $data['uid']]);
                    }


                    return [0, $orderId];
                } catch (\Exception $e) {
                    Db::rollback();
                    Db::name('debug_logs')->insert(["content" => $e->getMessage().$e->getFile().$e->getLine()]);
                    return [1, $e->getMessage().$e->getFile().$e->getLine()];
                }


            }

        } catch (ValidateException $e) {
            Db::name('debug_logs')->insert(["content" => $e->getMessage().$e->getFile().$e->getLine()]);
            return [1, $e->getMessage()];
        } catch (Exception $e) {
            Db::name('debug_logs')->insert(["content" => $e->getMessage().$e->getFile().$e->getLine()]);
            return [1, $e->getMessage()];
        }
    }

    /**
     * 订单日志
     * @param int $uid
     * @param int $mid
     * @param $orderId
     * @param $remark
     * @return int|string
     */
    public static function addLog($uid = 0, $mid = 0, $orderId, $remark, $json)
    {
        $data = [
            'uid' => $uid,
            'mid' => $mid,
            'order_id' => $orderId,
            'remark' => $remark,
            'json' => $json,
            'create_time' => time()
        ];
        return Db::name('order_logs')->insert($data);
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
    public static function addPayLog($outTradeNos, $orders, $totalFee, $tradeNo, $payWay, $remark, $mid = 0, $uid = 0, $type = 'order')
    {
        $data = [
            'out_trade_nos' => $outTradeNos,
            'orders' => $orders,
            'total_fee' => $totalFee,
            'trade_no' => $tradeNo,
            'pay_way' => $payWay,
            'remark' => $remark,
            'uid' => $uid,
            'type' => $type,
            'create_mid' => $mid,
            'create_time' => time()
        ];
        if($mid > 0){
            $data['status'] = 1;
            $data['pay_time'] = time();
        }
        $res = Db::name('pay_logs')->insert($data);
        if($res && $data['status'] == 1){
            UserModel::payAddScore($data['total_fee'],$uid);
        }
        return $res;
    }

    private function getTradeNo()
    {
//        $count = $this
//            ->where('create_time','>',strtotime(date('Y-m-d')))
//            ->where('uid',intval($uid))
        return date('Ymd', time()) . Str::random(6, 1);
    }

    /**
     * 读取主管的分组
     * @return array
     */
    public static function getChargeGroup($orderCats)
    {
        if (empty($orderCats)) {
            return [];
        }
        $groupList = Db::name('cats')
            ->where('type', 'base')
            ->where('is_deleted', 0)
            ->field('id,name')
            ->select()->toArray();
        $groupArr = array_combine(array_column($groupList, 'id'), $groupList);
        $groupCatList = [];
        $memberOrderCatArr = explode(',', $orderCats);
        foreach ($memberOrderCatArr as $cat) {
            if (!isset($groupArr[$cat])) {
                continue;
            }
            $groupCatList[] = $groupArr[$cat];
        }
        return $groupCatList;
    }


    /**
     * 取消订单
     * @param $id
     * @param int $uid
     * @param int $mid
     */
    public function cancelOrder($id, $uid = 0, $mid = 0,$remark='')
    {
        $map = [['id', '=', intval($id)]];
        if ($uid > 0) {
            $map[] = ['uid', '=', intval($uid)];
        }

        $orderInfo = $this
            ->where($map)
            ->find();
        if (!in_array($orderInfo['status'], [0, 1, 2])) {
            return [1, '该状态不能取消'];
        }
        if ($orderInfo['create_mid'] > 0 && $mid <= 0) {
            return [1, '该订单为客服添加，请联系客服处理'];
        }

        $data = [
            'status' => -1,
            'refund_remark' => $remark
        ];

        if ($mid > 0) {
            $data['last_update_mid'] = $mid;
        }

        if ($orderInfo['is_pay'] >= 1) {
            $data['refund'] = 0;
            $data['status'] = 6;
        }

        $this->startTrans();
        try {
            $res = $this->where('id', $orderInfo['id'])->save($data);
            if (!$res) {
                throw  new \Exception('取消失败');
            }
            //-- 加日志
            $res = OrderModel::addLog($mid > 0 ? 0 : $uid, $mid, $id, '取消了订单', '');
            if (!$res) {
                throw  new \Exception('记录日志失败');
            }

            if ($orderInfo['is_pay'] >= 1) {
                //-- 判断关联的支付是否有优惠券
                $payLogInfo = Db::name('pay_logs')
                    ->where('out_trade_nos','like',"%".$orderInfo['out_trade_no']."%")
                    ->where('status',1)
                    ->order('id desc')
                    ->find();
                if($payLogInfo && $payLogInfo['ucid'] > 0){
                    $res = Db::name('user_coupons')
                        ->where('id',$payLogInfo['ucid'])
//                        ->where('status',1)
                        ->update(['status' => 0,'use_time' => 0,'update_time' => time()]);
                    if(!$res){
                        throw  new \Exception('优惠券返还失败');
                    }
                }
            }


            $this->commit();

            //发送消息
            MnpAlertLogic::addAlertMsg('cancelorder',$orderInfo['uid'],['type' => 1,'order_id' => $orderInfo['id'],'amount' => $orderInfo['amount_rmb'],'order_sn' => $orderInfo['out_trade_no']]);

            return [0, '取消成功'];
        } catch (\Exception $e) {
            $this->rollback();
            return [1, $e->getMessage()];
        }
    }


    public function refundOrder($id, $mid = 0, $refundMoney)
    {
        $orderInfo = $this
            ->where('id', $id)
            ->where('status', 6)
            ->where('refund', 0)
            ->find();
        if (!$orderInfo) {
            return [1, '订单异常'];
        }

        $data = [
            'status' => 7,
            'refund' => 1,
            'last_update_mid' => $mid,
            'refund_money' => $refundMoney
        ];


        $this->startTrans();
        try {
            $res = $orderInfo->save($data);
            if (!$res) {
                throw  new \Exception('取消失败');
            }
            //-- 加日志
            $res = OrderModel::addLog(0, $mid, $id, '操作退款了订单', json_encode($data));
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

            if ($refundMoney > $orderInfo['actual_pay'] && $orderInfo['actual_pay'] > 0) {
                throw  new \Exception('金额高于实际支付金额');
            }
            $res = Db::name('refund_logs')
                ->where('order_id', $orderInfo['id'])
                ->find();
            if ($res) {
                throw  new \Exception('该订单貌似已退款');
            }

            $data = [
                'trade_no' => $payInfo['trade_no'],
                'out_trade_no' => $orderInfo['out_trade_no'],
                'refund_amount' => $refundMoney,
                'order_id' => $orderInfo['id'],
                'goods_name' => $orderInfo['goods_name'],
                'refund_trade_no' => $this->getTradeNo(),
                'uid' => $orderInfo['uid'],
                'total_pay_amount' => $payInfo['actual_pay'],
                'create_time' => time()
            ];
            $refundId = Db::name('refund_logs')
                ->insert($data, true);
            if (!$refundId) {
                throw  new \Exception('插入退款记录失败');
            }

            if (in_array($orderInfo['pay_way'], ['wepay', 'alipay','payclound'])) {
                list($err, $msg) = $this->doRefund($orderInfo, $payInfo, $refundId, $data['refund_trade_no'], $refundMoney);
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

    private function getPayRate($outTradeNo){
        $info = Db::name('pay_logs')
            ->where('out_trade_nos','like',"%$outTradeNo%")
            ->where('status',1)
            ->order('id desc')
            ->find();

        if(!$info){
            return 0;
        }
        $payInfo = Db::name('pay_notifys')
            ->where('out_trade_no','in',[$info['pay_out_trade_no'],$info['pay_no']])
            ->find();
        if(!$payInfo){
            return 0;
        }
        $extraArr = json_decode($payInfo['extra'],true);
        if(isset($extraArr['exchange_rate'])){
            return floatval($extraArr['exchange_rate']);
        }else if(isset($extraArr['trans_amount_cny'])){
            return $extraArr['trans_amount_cny']/$extraArr['trans_amount'];
        }else{
            return $info['total_fee']/$extraArr['trans_amount'];
        }

    }


    /**
     * 客服录入订单后，提醒用户前去支付
     * @param $orderId
     * @return bool
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public static function sendConfirmMsg($orderId){
        $templateId = 'bcAvJAN7K1ey2TP6uI2pSodGbx1lFqSX4j0PZiU7BWs';
        $orderInfo = Db::name('orders')
            ->alias('so')
            ->where('so.id',$orderId)
            ->join('st_user_wechat u','u.uid=so.uid and u.type="hwweapp"','LEFT')
            ->field('so.*,u.openid')
            ->find();
        if(!$orderInfo || empty($orderInfo['openid'])){
            return false;
        }
        $data = [
            'character_string1' =>['value' => $orderInfo['out_trade_no']],
            'thing2' =>['value' => $orderInfo['goods_name']],
            'amount3' =>['value' => $orderInfo['amount_rmb']],
            'time4' =>['value' => date('Y/m/d H:i:s',$orderInfo['update_time'])],
            'thing5' =>['value' => '您的订单客服已经确认，请尽快完成付款'] // 20个字符以内
        ];
        try {
            $weixin = new WechatApp('wx8ea38335fdde32a5','c76e77ffa1c4b1079ca63ee933490b2f');
            $weixin->sendMsg($orderInfo['openid'],$templateId,'pages/daishujun/index/index',$data);
            return true;
        }catch (\Exception $e){
            return false;
        }
    }

    /**
     * 发送出库提醒
     * @param $orderId
     * @return bool
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public static function sendOutStoreMsg($orderId){
        $templateId = 'FyRk9cVBE_e6R3axeIeN9oDmIkriRFLsK7237Xoh6ww';
        $orderInfo = Db::name('orders')
            ->alias('so')
            ->where('so.id',$orderId)
            ->join('st_user_wechat uw','uw.uid=so.uid','LEFT')
            ->field('so.*,uw.openid')
            ->find();
        if(!$orderInfo || empty($orderInfo['openid'])){
            return false;
        }

        $levelInfo = Db::name('users')
            ->alias('u')
            ->where('u.id',$orderInfo['uid'])
            ->join('st_user_levels l','l.id=u.level','LEFT')
            ->field('u.*,l.store_days')
            ->find();


        $data = [
            'character_string1' =>['value' => $orderInfo['out_trade_no']],
            'thing2' =>['value' => mb_strlen($orderInfo['goods_name'])>20?mb_substr($orderInfo['goods_name'],0,20):$orderInfo['goods_name']],
            'time3' =>['value' => date('Y/m/d H:i:s',$orderInfo['store_time'])],
            'time4' =>['value' => date('Y/m/d H:i:s',strtotime('+'.$levelInfo['store_days'].' days',$orderInfo['store_time']))],
        ];

        //-- 公众号提醒
        MnpAlertLogic::addAlertMsg('storedeadline',$orderInfo['uid'],['goods_name' => mb_strlen($orderInfo['goods_name'])>20?mb_substr($orderInfo['goods_name'],0,20):$orderInfo['goods_name'],'deadline' => strtotime('+'.$levelInfo['store_days'].' days',$store_time)]);
        try {
            $weixin = new WechatApp('wx8ea38335fdde32a5','c76e77ffa1c4b1079ca63ee933490b2f');
            $weixin->sendMsg($orderInfo['openid'],$templateId,'pages/daishujun/index/index',$data);
            return true;
        }catch (\Exception $e){
            return false;
        }
    }

    public static function sendOutStoreGroupMsg($uid,$out_trade_no,$goodsName,$store_time){
        $templateId = 'FyRk9cVBE_e6R3axeIeN9oDmIkriRFLsK7237Xoh6ww';
        $levelInfo = Db::name('users')
            ->alias('u')
            ->where('u.id',$uid)
            ->join('st_user_levels l','l.id=u.level','LEFT')
            ->join('st_user_wechat uw','uw.id=u.level','LEFT')
            ->field('u.*,l.store_days,uw.openid')
            ->find();
        $data = [
            'character_string1' =>['value' => $out_trade_no],
            'thing2' =>['value' => $goodsName],
            'time3' =>['value' => date('Y/m/d H:i:s',$store_time)],
            'time4' =>['value' => date('Y/m/d H:i:s',strtotime('+'.$levelInfo['store_days'].' days',$store_time))],
        ];

        //-- 公众号提醒
        MnpAlertLogic::addAlertMsg('storedeadline',$uid,['goods_name' => $goodsName,'deadline' => strtotime('+'.$levelInfo['store_days'].' days',$store_time)]);
        try {
            $weixin = new WechatApp('wx8ea38335fdde32a5','c76e77ffa1c4b1079ca63ee933490b2f');
            $weixin->sendMsg($levelInfo['openid'],$templateId,'pages/daishujun/index/index',$data);
            return true;
        }catch (\Exception $e){
            return false;
        }
    }

    /**
     * 出库提醒
     */
    public static function alertStoreTime(){
        $list = Db::name('orders')
            ->where('status',3)
            ->where('store_time','<',time()-25*86400)
            ->field('id,out_trade_no,goods_name,store_time,uid,count(*) as number')
            ->order('store_time asc')
            ->group('uid')
            ->select()->toArray();

        $redis = new StRedis();
        foreach ($list as $item){
            $key = 'alert_store_order_'.$item['uid'];
            $cache = $redis->get($key);
            if(intval($cache) > 0){
                continue;
            }
            if($item['number'] > 1){
                $outTradeNo = sprintf('%s..',$item['out_trade_no']);
                $goodsName = sprintf('%s..等%s件',mb_substr($item['goods_name'],0,10),$item['number']);
                $res = OrderModel::sendOutStoreGroupMsg($item['uid'],$outTradeNo,$goodsName,$item['store_time']);
            }else{
                $res = OrderModel::sendOutStoreMsg($item['id']);
            }
            $redis->set($key,time(),3*86400);
            if($res){

            }

        }

    }



    /**
     * 删除订单
     * @param $id
     * @param int $uid
     * @param int $mid
     */
    public function deleteOrder($id, $mid = 0)
    {
        $data = [
            'is_deleted' => 1,
            'last_update_mid' => $mid
        ];

        $this->startTrans();
        try {
            $res = $this->where('id', $id)->save($data);
            if (!$res) {
                throw  new \Exception('删除失败');
            }
            //-- 加日志
            $res = OrderModel::addLog(0, $mid, $id, '删除了订单', '');
            if (!$res) {
                throw  new \Exception('记录日志失败');
            }
            $this->commit();
            return [0, '删除成功'];
        } catch (\Exception $e) {
            $this->rollback();
            return [1, $e->getMessage()];
        }
    }
}