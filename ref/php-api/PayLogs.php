<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 17:45
 * description:
 */

namespace app\common\model;

use app\common\library\Taobao;
use app\common\library\Wecom;
use app\common\logic\JobQueueLogic;
use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\facade\Db;
use think\helper\Str;
use think\Model;
use think\Validate;

class PayLogs extends Model
{
    protected $table = 'st_pay_logs';

    public function addPayLog($outTradeNos, $orders, $totalFee, $tradeNo, $payWay, $remark, $mid = 0, $uid = 0, $type = 'order', $status = 0, $goodsName = '',$coupon=false)
    {
        $data = [
            'out_trade_nos' => $outTradeNos,
            'orders' => $orders,
            'total_fee' => $totalFee,
            'trade_no' => $tradeNo,
            'pay_way' => $payWay,
            'remark' => $remark,
            'goods_name' => $goodsName,
            'uid' => $uid,
            'status' => 0,
            'actual_pay' => $status > 0 ? $totalFee : 0,
            'pay_time' => $status > 0 ? time() : 0,
            'type' => $type,
            'pay_out_trade_no' => $this->getTradeNo(),
            'create_mid' => $mid,
            'create_time' => time()
        ];
        if($coupon){
            $data['total_fee'] -= $coupon['money'];
            $data['ucid'] = $coupon['ucid'];
            $data['coupon_name'] = $coupon['name'];
            $data['coupon_fee'] = $coupon['money'];
        }
        $res = $this->insert($data, true);
        if ($res) {
            $data['id'] = $res;
            return $data;
        }
        return false;
    }

    public function getTradeNo()
    {
        return date('Ymdhis', time()) . Str::random(6, 1);
    }

    /**
     * 支付回调
     * trade_no,total_fee,out_trade_no
     * @param $data
     */
    public function doPay($data)
    {
        //-- 判断是否在订单表里
        $payNoResult = Db::name('pay_log_paynos')
            ->where('out_trade_no',$data['out_trade_no'])
            ->find();
        if($payNoResult){
            $data['out_trade_no'] = $payNoResult['pay_out_trade_no'];
        }

        
        $info = $this
            ->where('pay_out_trade_no|pay_no', $data['out_trade_no'])
            ->where('status', 0)
            ->find();
        if (!$info) {
            return false;
        }

        if($data['total_fee'] <=0){
            $rate = config('config.WECHAT_PAY_RATE',0);
            $data['total_fee'] = round($info['total_fee_jp']*$rate,2);
        }

        $paydata = [
            'pay_way' => $data['payway'],
            'trade_no' => $data['trade_no'],
            'status' => 1,
            'pay_time' => time(),
            'actual_pay' => $data['total_fee'],
            'actual_pay_jp' => $data['total_fee_jp'],
        ];
        $res = $info->save($paydata);
        if (!$res) {
            return false;
        }


        Db::startTrans();
        try {
            $res = false;
            if ($info['type'] == 'order') {
                $res = $this->payOrder(explode(',', $info['out_trade_nos']), $info['uid'], $data);
            }
            else if ($info['type'] == 'shipment') {
                $res = $this->payShipment(explode(',', $info['out_trade_nos']), $info['uid'], $data);
            }
            else if ($info['type'] == 'deposit') {
                $res = $this->payDeposit($info['uid'], $data);
            }
            else if ($info['type'] == 'vip') {
                $res = VipOrders::pay($info, $data);
            }
            if (!$res) {
                Db::rollback();
                return false;
            }

            //-- 消费给积分
            UserModel::payAddScore($data['total_fee'],$info['uid']);

            //-- 处理优惠券
            if($info['ucid'] > 0){
                $res = Db::name('user_coupons')
                    ->where('id',$info['ucid'])
                    ->where('status',0)
                    ->update(['status' => 1,'use_time' => time()]);
                if(!$res){
                    Db::rollback();
                    return false;
                }
            }

            Db::commit();
            return true;
        }
        catch (\Exception $e) {
            return false;
        }
    }

    private function payOrder($outTradeNoArr, $uid, $payData)
    {
        $orderList = Db::name('orders')
            ->where('out_trade_no', 'in', $outTradeNoArr)
            ->select()->toArray();
//        $res = Db::name('orders')
//            ->where('out_trade_no', 'in', $outTradeNoArr)
//            ->where('is_pay', 0)
//            ->save(['is_pay' => 1, 'status' => 1, 'pay_way' => $payData['payway'], 'trade_no' => $payData['trade_no'], 'actual_pay' => $payData['total_fee'], 'update_time' => time()]);
//        if (!$res) {
//            return false;
//        }

        foreach ($orderList as $order) {
            //-- 区分开后台录入的
            $res = Db::name('orders')
                ->where('id', $order['id'])
                ->where('is_pay', 0)
                ->save(['is_pay' => 1,'pay_time' => time(), 'status' => $order['create_mid'] > 0?2:1, 'pay_way' => $payData['payway'], 'trade_no' => $payData['trade_no'], 'actual_pay' => $payData['total_fee'], 'update_time' => time()]);
            if (!$res) {
                return false;
            }


            Wecom::addAlertMsg('order',$order['id']);
            $res = OrderModel::addLog($uid, 0, $order['id'], '订单支付', '');
            if (!$res) {
                return false;
            }

            //检测连续购买
            JobQueueLogic::addQueue('lxbuycoupon',['order_id' => $order['id'],'uid' => $order['uid']]);
        }
        return true;
    }

    private function payShipment($outTradeNoArr, $uid, $payData)
    {
        $res = Db::name('shipment_orders')
            ->where('out_trade_no', 'in', $outTradeNoArr)
            ->where('is_pay', 0)
            ->save(['is_pay' => 1, 'status' => 2, 'pay_way' => $payData['payway'], 'trade_no' => $payData['trade_no'], 'actual_pay' => $payData['total_fee'], 'update_time' => time()]);
        if (!$res) {
            return false;
        }
        return true;
    }

    private function payDeposit($uid, $payData)
    {
        $res = Db::name('users')
            ->where('id', intval($uid))
            ->inc('deposit', $payData['total_fee'])
            ->update();

        $res1 = Db::name('user_refunds')
            ->insert([
                'uid' => $uid,
                'money' => $payData['total_fee'],
                'alipay_no' => '',
                'alipay_realname' => '',
                'pay_way' => $payData['payway'],
                'status' => 1,
                'type' => 'recharge',
                'create_time' => time(),
                'update_time' => time()
            ]);

        return $res;
    }


    /**
     * 检查淘宝支付
     * @param $amountRmb
     * @return false|string[]|\think\response\Json
     */
    public static function checkTaobao($taobaoNo,$amountRmb){
        $taobaoNoArr = explode('|',$taobaoNo);
        $likeArr = [];
        foreach ($taobaoNoArr as $t){
            $likeArr[] = '%'.$t.'%';
        }
        //-- 判断是否已经使用过
        $count = Db::name('pay_logs')
            ->where('pay_way','taobao')
//            ->where('status',1)
            ->where('trade_no','like',$likeArr,'OR')
            ->count();
        if(intval($count) > 0){
            return [1,'该淘宝订单号已经使用'];
        }

        $totalFee = 0;
        // taobao情報取得
        $api = new Taobao();
        foreach ($taobaoNoArr as $tid){

            try {
                $taobao = $api->getTaobaoOrder($tid);
            }
            catch (\Exception $e) {
                return [1,'淘宝订单获取失败' . $e->getMessage()];
            }
            $totalFee += floatval($taobao['TotalFee']);
        }

        if ($totalFee < floatval($amountRmb)) {
            return [1,'淘宝金额不得小于订单金额'];
        }
        return [0,$taobaoNoArr];
    }
}