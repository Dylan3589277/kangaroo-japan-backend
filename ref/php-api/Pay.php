<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 15:15
 * description: 支付相关操作
 */

namespace app\api\controller;

use app\common\library\H5Alipay;
use app\common\library\PayClound;
use app\common\library\PayParams;
use app\common\library\Taobao;
use app\common\library\Wepay;
use app\common\model\Configs;
use app\common\model\OrderModel;
use app\common\model\PayLogs;
use app\common\model\UserModel;
use think\App;
use think\facade\Db;
use Tools\StRedis;

class Pay extends Base
{
    public function __construct(App $app)
    {
        $this->noNeedLogin = ['notify','gwnotify', 'alipaynotify', 'wepaynotify', 'alipay','daipay','dopay'];
        parent::__construct($app);
    }

    private function payList()
    {
        $appid = input('appid','');
        if($appid == 'wx8ea38335fdde32a5'){

            return [
                [
                    'name' => '微信支付',
                    'desc' => '推荐优先使用微信支付',
                    'type' => 'wepay',
                    'checked' => true,
                    'icon' => '/static/image/wechat_icon.png'
                ],
           [
                'name' => '支付宝支付',
                'desc' => '支付时请使用4G网络，并关闭支付宝的位置共享!',
                'type' => 'alipay',
                'checked' => false,
                'icon' => '/static/image/alipay_icon.png'
            ],
            ];
        }else if($appid == 'wx208645d960d3f104'){
            return [
                [
                    'name' => '微信支付',
                    'desc' => '推荐优先使用微信支付',
                    'type' => 'wepay',
                    'checked' => true,
                    'icon' => '/static/image/wechat_icon.png'
                ],
                [
                    'name' => '支付宝支付',
                    'desc' => '支付时请使用4G网络，并关闭支付宝的位置共享!',
                    'type' => 'alipay',
                    'checked' => false,
                    'icon' => '/static/image/alipay_icon.png'
                ],
            ];
        }
        return [
            [
                'name' => '支付宝支付',
                'desc' => '支付时请使用4G网络，并关闭支付宝的位置共享!',
                'type' => 'alipay',
                'checked' => false,
                'icon' => '/static/image/alipay_icon.png'
            ],
        ];
//        return [
//            [
//                'name' => '微信支付',
//                'desc' => '推荐优先使用微信支付',
//                'type' => 'wepay',
//                'checked' => true,
//                'icon' => '/static/image/wechat_icon.png'
//            ],
//            [
//                'name' => '支付宝支付',
//                'desc' => '小程序中复制链接后请用浏览器打开',
//                'type' => 'alipay',
//                'checked' => false,
//                'icon' => '/static/image/alipay_icon.png'
//            ],
//            [
//                'name' => '淘宝支付',
//                'desc' => '请先到淘宝中下单复制订单号',
//                'type' => 'taobao',
//                'checked' => false,
//                'icon' => '/static/image/tao_icon.png'
//            ]
//        ];
    }

    /**
     * 获取支付信息
     * @return \think\response\Json
     */
    public function getpay()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $type = input('type', '');
        if (!in_array($type, ['order', 'shipment', 'deposit','vip'])) {
            $this->jerror('类型错误');
        }

        if ($type == 'order') {
            $this->payOrder($this->uid);
        }
        else if ($type == 'shipment') {
            $this->payShipment($this->uid);
        }
        else if ($type == 'deposit') {
            $this->payDeposit($this->uid);
        }else  if ($type == 'vip') {
            $this->payVipOrder($this->uid);
        }
    }


    /**
     * 好友代拍
     */
    public function daipay()
    {
        if (!$this->request->isPost()) {
            $this->jerror('method error');
        }
        $type = input('type', '');
        if (!in_array($type, ['order', 'shipment', 'deposit','vip'])) {
            $this->jerror('类型错误');
        }
        $uid=input('uid',0);
        if(intval($uid) <=0){
            $this->jerror('参数错误');
        }

        if ($type == 'order') {
            $this->payOrder($uid);
        }
        else if ($type == 'shipment') {
            $this->payShipment($uid);
        }
        else if ($type == 'deposit') {
            $this->payDeposit($uid);
        }else  if ($type == 'vip') {
            $this->payVipOrder($uid);
        }
    }

    /**
     * 获取优惠券
     * @param $amount
     * @param string $orderType
     * @return array
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    private function _getCoupons($amount,$orderType='goods'){
        $list = Db::name('user_coupons')
            ->where('uid',$this->uid)
            ->where('order_type','in',['normal',$orderType])
            ->where('status',0)
            ->where('expire','>',time())
            ->whereRaw('`condition`=? or `condition`<=?',[0,$amount])
            ->field('id,name')
            ->select()->toArray();
        return $list;
    }

    /**
     * 检查优惠券
     * @param $amount
     * @param string $orderType
     * @return array|false
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    private function _checkCoupon($amount,$orderType='goods'){
        $ucid = input('ucid',0);
        $couponArr = false;
        if($ucid > 0){
            $userCouponInfo = Db::name('user_coupons')
                ->where('id',$ucid)
                ->where('uid',$this->uid)
                ->where('order_type','in',['normal',$orderType])
                ->where('status',0)
                ->where('expire','>',time())
                ->find();
            if(!$userCouponInfo){
                throw new \Exception('该优惠券不存在');
            }
            if($userCouponInfo['condition'] > 0 && $userCouponInfo['condition'] > $amount){
                throw new \Exception(sprintf('该优惠券满%s不可用',$userCouponInfo['condition']));
            }
            $couponName = $userCouponInfo['name'];
            if($userCouponInfo['type'] == 'rate'){
                $couponMoney = $amount - round($amount*$userCouponInfo['data'],2);
            }else{
                $couponMoney = $userCouponInfo['data'];
            }
            $couponArr = [
                'ucid' => $ucid,
                'name' => $couponName,
                'money' => round($couponMoney,2)
            ];
        }
        return $couponArr;
    }

    /**
     * 支付订单
     */
    private function payOrder($uid=0)
    {
        $ids = $this->request->post('ids', '');
        if (empty($ids)) {
            $this->jerror('请选择处理的订单');
        }

        $idArr = explode(',', $ids);
        $orderList = Db::name('orders')
            ->where('is_pay', 0)
            ->where('id', 'in', $idArr)
            ->where('uid', $uid)
            ->select()->toArray();
        if (count($orderList) != count($idArr)) {
            $this->jerror('选择的订单异常'.$uid.'_'.$ids);
        }

        $expireDays = config('config.PAY_EXPIRE_TIME', 0);
        $expireRate = config('config.PAY_EXPIRE_RATE', 0);
        $amount = 0;
        $expireStartTime = strtotime(sprintf('-%s days', $expireDays+1), time());
        $overFee = 0;
        $showOrderList = [];
        foreach ($orderList as $item) {
            $amount += $item['amount_rmb'];
            $overTimeFee = 0;
            if ($item['create_mid'] > 0 && $item['create_time'] < $expireStartTime) {
                $day = ceil((time() - $item['create_time']) / 86400)-2;
                $overTimeFee = $day * $item['amount_rmb'] * $expireRate;
                Db::name('orders')
                    ->where('id',$item['id'])
                    ->save(['pay_over_time_fee' => $overTimeFee]);
            }
            $overFee += $overTimeFee;
            $amount += $overTimeFee;

            $showOrderList[] = [
                'cover' => $item['cover'],
                'goods_name' => $item['goods_name'],
                'price' => $item['amount']
            ];
        }

        $amountList = [];
        if ($overFee > 0) {
            $amountList[] = ['text' => '超时支付费用', 'amount' => '+￥' . $overFee];
        }

        Db::startTrans();
        try {
            $outTradeNos = implode(',', array_column($orderList, 'out_trade_no'));
            $orders = implode(',', array_column($orderList, 'id'));
            $goodsName = implode(',', array_column($orderList, 'goods_name'));
            $goodsName = mb_strlen($goodsName) > 200 ? mb_substr($goodsName, 0, 200) : $goodsName;
            //-- 检查优惠券
            $couponArr = $this->_checkCoupon($amount,'goods');
            $result = (new PayLogs())->addPayLog($outTradeNos, $orders, $amount, '', '', '用户订单支付', 0, $orderList[0]['uid'], 'order', 0, $goodsName,$couponArr);
            if (!$result) {
                throw new \Exception('日志处理失败');
            }

            Db::commit();

            if($couponArr){
                $amountList[] = ['text' => '优惠金额','amount' => $couponArr['money'].'元'];
            }
//            $url = 'http://app.kangaroo-japan.com/api/pay/alipay?out_trade_no=' . $result['pay_out_trade_no'];
            $url = $this->getAlipay($result);


            $userInfo = (new UserModel())->where('id',$uid)->field('id,nickname,avatar')->find()->toArray();

            return $this->jsuccess('请求成功', ['amount' => $result['total_fee'],
                'pay_url' => $url,
                'default_pay_way' => 'alipay',
                'amountList' => $amountList,
                'couponList' => $this->_getCoupons($amount),
                'pay_out_trade_no' => $result['pay_out_trade_no'],
                'payList' => $this->payList(),
                'showOrderList' => $showOrderList,
                'userInfo' => $userInfo
            ]);
        }
        catch (\Exception $e) {
            Db::rollback();
            return $this->jerror('处理失败' . $e->getMessage());
        }
    }

    /**
     * 支付订单
     */
    private function payVipOrder($uid=0)
    {
        $ids = $this->request->post('ids', '');
        if (empty($ids)) {
            $this->jerror('请选择处理的订单');
        }

        $orderInfo = Db::name('vip_orders')
            ->where('is_pay', 0)
            ->where('id', intval($ids))
            ->where('uid', $uid)
            ->where('create_time','>',time() - 300)
            ->find();
        if (!$orderInfo) {
            $this->jerror('选择的订单异常');
        }

        $amountList = [];
        if ($orderInfo['offset_amount'] > 0) {
            $amountList[] = ['text' => '等级差额费用', 'amount' => '+￥' . $orderInfo['offset_amount']];
        }

        try {

            $result = (new PayLogs())->addPayLog($orderInfo['out_trade_no'], $orderInfo['id'], $orderInfo['amount'], '', '', '用户会员订单支付', 0, $orderInfo['uid'], 'vip', 0, $orderInfo['level_name'].'x'.$orderInfo['month'].'月');
            if (!$result) {
                throw new \Exception('日志处理失败');
            }


//            $url = 'http://app.kangaroo-japan.com/api/pay/alipay?out_trade_no=' . $result['pay_out_trade_no'];
            $url = $this->getAlipay($result);
            $userInfo = (new UserModel())->where('id',$uid)->field('id,nickname,avatar')->find()->toArray();
            return $this->jsuccess('请求成功', ['amount' => $result['total_fee'],
                'pay_url' => $url,
                'default_pay_way' => 'alipay',
                'amountList' => $amountList,
                'couponList' => [],
                'pay_out_trade_no' => $result['pay_out_trade_no'],
                'payList' => $this->payList(),
                'userInfo' => $userInfo
            ]);
        }
        catch (\Exception $e) {
            return $this->jerror('处理失败' . $e->getMessage());
        }
    }

    /**
     * 出库订单
     * @return \think\response\Json
     */
    private function payShipment($uid=0)
    {
        $ids = $this->request->post('ids', '');
        if (empty($ids)) {
            $this->jerror('请选择处理的订单');
        }
        $idArr = explode(',', $ids);
        $orderList = Db::name('shipment_orders')
            ->where('is_pay', 0)
            ->where('id', 'in', $idArr)
            ->where('status', 1)
            ->where('uid', $uid)
            ->select()->toArray();
        if (count($orderList) != count($idArr)) {
            $this->jerror('选择的订单异常');
        }
        $expireDays = config('config.PAY_EXPIRE_TIME', 0);
        $expireRate = config('config.PAY_EXPIRE_RATE', 0);
        $amount = 0;
        $expireStartTime = strtotime(sprintf('-%s days', $expireDays), time());
        foreach ($orderList as $item) {
            $amount += $item['amount_rmb'];
            $overTimeFee = 0;
            if ($item['create_mid'] > 0 && $item['create_time'] < $expireStartTime) {
                $day = ceil(time() - $item['create_time'] / 86400);
                $overTimeFee = $day * $item['amount_rmb'] * $expireRate;
                Db::name('orders')
                    ->save(['pay_over_time_fee' => $overTimeFee]);
            }
            $amount += $overTimeFee;
        }
        Db::startTrans();
        try {
            $outTradeNos = implode(',', array_column($orderList, 'out_trade_no'));
            $orders = implode(',', array_column($orderList, 'id'));
            //-- 检查优惠券
            $couponArr = $this->_checkCoupon($amount,'ship');

            $result = (new PayLogs())->addPayLog($outTradeNos, $orders, $amount, '', '', '出库订单支付', 0, $orderList[0]['uid'], 'shipment', 0, '出库物流订单支付',$couponArr);
            if (!$result) {
                throw new \Exception('日志处理失败');
            }

            Db::commit();
//            $url = 'http://app.kangaroo-japan.com/api/pay/alipay?out_trade_no=' . $result['pay_out_trade_no'];
            $url = $this->getAlipay($result);
            $amountList = [];
            if($couponArr){
                $amountList[] = ['text' => '优惠金额','amount' => $couponArr['money']];
            }
            $userInfo = (new UserModel())->where('id',$uid)->field('id,nickname,avatar')->find()->toArray();
            return $this->jsuccess('请求成功', ['amount' => $result['total_fee'],
                'pay_url' => $url,
                'amountList' => $amountList,
                'default_pay_way' => 'alipay',
                'couponList' => $this->_getCoupons($amount,'ship'),
                'pay_out_trade_no' => $result['pay_out_trade_no'],
                'payList' => $this->payList(),
                'userInfo' => $userInfo
            ]);
        }
        catch (\Exception $e) {
            Db::rollback();
            return $this->jerror('处理失败' . $e->getMessage());
        }
    }

    /**
     * 押金支付
     */
    public function payDeposit($uid=0)
    {
        $money = input('money', '');
        if (intval($money) <= 0) {
            return $this->jerror('金额错误');
        }
        if (intval($money) != $money) {
            return $this->jerror('只能充值整数金额');
        }
        if (intval($money) % 100 != 0) {
//            return $this->jerror('只能充值100整数倍数');
        }
        $result = (new PayLogs())->addPayLog('', '', $money, '', '', '押金支付', 0, $uid, 'deposit', 0, '竞拍押金支付');
        if (!$result) {
            throw new \Exception('日志处理失败');
        }
//        $url = 'http://app.kangaroo-japan.com/api/pay/alipay?out_trade_no=' . $result['pay_out_trade_no'];
        $url = $this->getAlipay($result);
        $userInfo = (new UserModel())->where('id',$uid)->field('id,nickname,avatar')->find()->toArray();
        return $this->jsuccess('请求成功', ['amount' => $money,
            'amountList' => [],
            'pay_url' => $url,
            'default_pay_way' => 'alipay',
            'pay_out_trade_no' => $result['pay_out_trade_no'],
            'couponList' => [],
            'payList' => $this->payList(),
            'userInfo' => $userInfo
        ]);
    }

    /**
     * 日本微信支付
     * @return string
     */
    public function gwnotify()
    {
        $xml = isset($GLOBALS['HTTP_RAW_POST_DATA']) ? $GLOBALS['HTTP_RAW_POST_DATA'] : file_get_contents("php://input");
//        $xml = '{"trans_end_time":"2022-07-02 12:38:48","charset":"UTF-8","store_no":"4122000716","pay_scenario":"MINI_PROGRAM_PAY","sign":"HZsQcUVkGbhoCk/DmXc3ICl5AqQ/OplRN58DFglb+83bo0I4lnuWVp7Mj1xdbLNGo+c/AeZ5i0cZ9AyMDVHg7jd90U0F5jlploXFo4eFcJv4P2uSzggx/rCm7Z6e6bw9q5HxXd0qpKVGoDFEl1ceVSdAt+2qRo7n1nOrdwlEjgttgC+eTRZpCK3mtQgqPf81XhkQqip2ivKlKD2U8slyHC81g4z2z8JjnHlP2vzWhVuSddhc70scuvXkCMZ/NuJJU/08X87zTFjGlGTQ5gTox8vVTVT7HMeewg7PS17qoiu7C6igEMt3HXVxGVouFxDJ6L3/raqoqqJneqI6C+wROQ==","merchant_order_no":"20220702083816914558","discount_bpc":"0","vat_amount":"0","trans_amount_cny":"0.99","app_id":"wzcbbbf716c84b8b0b","sign_type":"RSA2","trans_status":2,"price_currency":"JPY","trans_type":1,"timestamp":"1656765547926","trans_no":"20220702083816914558","merchant_no":"312200056803","exchange_rate":"0.049574860000","method":"payment.result.notify","pay_user_account_id":"o0Jpf0ZpU9EiWW7Ym4wQlcJGvdHE","format":"JSON","pay_method_id":"WeChatPay","trans_amount":"20","http_request_id":"07021239071926740280","version":"1.0","pay_channel_trans_no":"4200001469202207024408784129","paid_amount":"20","discount_bmopc":"0"}';
        if (empty($xml)) {
            return "fail";
        }
        $pay = new PayClound();
        $data = json_decode($xml,true);
//        print_r($data);
        if ($data['merchant_order_no']) {
            $log = [
                'trade_no' => $data['trans_no']??'',
                'out_trade_no' => $data['merchant_order_no'],
                'create_time' => time(),
                'total_fee' => $data['trans_amount_cny']??'',
                'status' => $data['trans_status']??'',
                'buyer_id' => $data['pay_user_account_id']??'',
                'buyer_email' => '',
                'extra' => json_encode($data)
            ];
            Db::name('pay_notifys')->insert($log);
        }
//        Db::name('config')
//            ->where('name','WECHAT_PAY_RATE')
//            ->save(['value' => $data['exchange_rate']]);
//        Configs::clearCache();
        if (!$pay->CheckSign($data)) {
            return "fail";
        }
        else {
            if (intval($data['trans_status']) != 2) {
                return "fail";
            }
            (new PayLogs())->doPay(['payway' => 'payclound', 'out_trade_no' => $data['merchant_order_no'], 'trade_no' => $data['trans_no'], 'total_fee' => $data['trans_amount_cny']??0,'total_fee_jp' => $data['paid_amount']??0]);
            return "success";
        }
    }

    /**
     * 微信支付回调
     */
    public function wepaynotify()
    {
        $xml = isset($GLOBALS['HTTP_RAW_POST_DATA']) ? $GLOBALS['HTTP_RAW_POST_DATA'] : file_get_contents("php://input");
        $config = config('app.wepay');
        $pay = new WePay($config);
        if (empty($xml)) {
            return $pay->ToXml(['return_code' => 'FAIL', 'return_msg' => 'FAIL']);
        }
        file_put_contents(runtime_path() . 'notify.txt', $xml);
        $data = $pay->FromXml($xml);
        if ($data['out_trade_no']) {
            $log = [
                'trade_no' => $data['transaction_id'],
                'out_trade_no' => $data['out_trade_no'],
                'create_time' => time(),
                'total_fee' => $data['total_fee'] / 100,
                'status' => $data['result_code'],
                'buyer_id' => $data['openid'],
                'buyer_email' => '',
                'extra' => json_encode($data)
            ];
            Db::name('pay_notifys')->insert($log);
        }
        if (!$pay->CheckSign($data)) {
            return $pay->ToXml(['return_code' => 'FAIL', 'return_msg' => 'FAIL']);
        }
        else {
            if (strtolower($data['result_code']) != 'success') {
                return $pay->ToXml(['return_code' => 'FAIL', 'return_msg' => 'FAIL']);
            }
            (new PayLogs())->doPay(['payway' => 'wepay', 'out_trade_no' => $data['out_trade_no'], 'trade_no' => $data['transaction_id'], 'total_fee' => $data['total_fee'] / 100]);
            return $pay->ToXml(['return_code' => 'SUCCESS', 'return_msg' => 'OK']);
        }
    }

    /**
     * 支付宝支付回调
     *
     * @return void
     */
    public function alipaynotify()
    {
        $str = file_get_contents('php://input');
        $arr = [];
        parse_str($str, $arr);
        if(!isset($arr['sign'])){
            return "fail";
        }
        $sign = $arr['sign'];
        unset($arr['sign']);
        unset($arr['sign_type']);
        $config = config('app.alipay');
        $pay = new H5Alipay($config);
        ksort($arr);
        if ($arr['out_trade_no']) {
            $log = [
                'trade_no' => $arr['trade_no'],
                'out_trade_no' => $arr['out_trade_no'],
                'create_time' => time(),
                'total_fee' => $arr['total_amount'],
                'status' => $arr['trade_status'],
                'buyer_id' => $arr['buyer_id'],
                'buyer_email' => $arr['buyer_logon_id'],
                'extra' => $str
            ];
            Db::name('pay_notifys')->insert($log);
        }
        $str = urldecode(http_build_query($arr));
        $newSign = $pay->verify($str, $sign, 'RSA2');
        if (!$newSign) {
            return 'fail';
        }
        if (strtoupper($arr['trade_status']) != 'TRADE_SUCCESS') {
            return 'fail';
        }
        (new PayLogs())->doPay(['payway' => 'alipay', 'out_trade_no' => $arr['out_trade_no'], 'trade_no' => $arr['trade_no'], 'total_fee' => $arr['total_amount']]);
        return 'success';
    }

    /**
     * 申请支付
     */
    public function dopay()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('method error');
        }
        $outTradeNo = input('out_trade_no', '');
        if (empty($outTradeNo)) {
            return $this->jerror('错误的请求');
        }
        $payInfo = Db::name('pay_logs')
            ->where('pay_out_trade_no', $outTradeNo)
            ->find();
        if (!$payInfo) {
            return $this->jerror('错误的支付');
        }
        if ($payInfo['status'] != 0) {
            return $this->jerror('错误的请求');
        }
        $payWay = input('payway', '');
        if ($payWay == 'wepay') {
            return $this->requestWepay($payInfo);
        }else if ($payWay == 'alipay') {
            $url = $this->getAlipay($payInfo);
            if(empty($url)){
                return $this->jerror('发起支付失败');
            }
            return $this->jsuccess('请求成功', [
                'pay_url' => $url
            ]);
       } else if ($payWay == 'taobao') {
            return $this->taobaoPay($payInfo);
        }
        return $this->jerror('支付失败');
    }

    /**
     * 淘宝支付
     * @param $payInfo
     */
    public function taobaoPay($payInfo)
    {
        $orderNum = input('tid', '');
        if (empty($orderNum)) {
            return $this->jerror('请输入淘宝订单号');
        }

        //-- 判断是否已使用
        $payLogModel = new PayLogs();
        $info = $payLogModel
            ->where('trade_no',$orderNum)
            ->where('pay_way','taobao')
            ->find();
        if($info){
            return $this->jerror('该淘宝订单已使用Err1');
        }

        //-- like 查询一次
        $taobaoNoArr = explode('|',$orderNum);
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
            return $this->jerror('该淘宝订单号已经使用Err2');
        }

        // taobao情報取得
        $api = new Taobao();
        try {
            $taobao = $api->getTaobaoOrder($orderNum);
        }
        catch (\Exception $e) {
            return $this->jerror('淘宝订单获取失败' . $e->getMessage());
        }

        // 注文金額の確認
        if ($taobao['TotalFee'] != ceil($payInfo['total_fee'])) {
            return $this->jerror('淘宝金额跟订单金额不一致');
        }

        // 自动发货
        if ($taobao['Status'] == 'WAIT_SELLER_SEND_GOODS') {
            // 调接口发货
            try {
                $send = $api->logisticsDummySend($orderNum);
                if (!$send) {
                    throw new \Exception('处理状态失败');
                }
                return $this->jsuccess('自动发货成功，请确认收货后再继续支付',['status' => 1]);
            }
            catch (\Exception $e) {
                return $this->jerror('发货失败，请稍后再试');
            }
        }
        else if ($taobao['Status'] == 'TRADE_FINISHED') {

            Db::startTrans();
            try {
                $res = (new PayLogs())->doPay(['payway' => 'taobao', 'out_trade_no' => $payInfo['pay_out_trade_no'], 'trade_no' => $orderNum, 'total_fee' => $taobao['TotalFee']]);
                if (!$res) {
                    throw new \Exception('处理状态失败');
                }
                Db::commit();
                return $this->jsuccess('支付成功',['status' => 2]);
            }
            catch (\Exception $e) {
                Db::rollback();
                return $this->jerror('支付失败' . $e->getMessage());
            }
        }
        return $this->jerror($taobao['Status']=='WAIT_BUYER_CONFIRM_GOODS'?'请先去淘宝确认收货':'错误的操作');
    }



    /**
     * 请求微信支付
     *
     * @param [type] $payInfo
     * @param string $tradeType
     */
    private function requestWepay($payInfo, $tradeType = 'JSAPI')
    {
        $appid = input('appid','');
        if($appid == 'wx208645d960d3f104'){
            return $this->payClound($payInfo);
        }
        return $this->jerror('支付已下线，请联系客服');
        $config = config('app.wepay');
        $pay = new Wepay($config);
        try {
            $data = [
                'out_trade_no' => $payInfo['pay_out_trade_no'],
                'body' => '袋鼠君统一支付',
                'total_fee' => intval(floatval($payInfo['total_fee']) * 100),
//                'total_fee' => 1,
                'trade_type' => $tradeType,
                'notify_url' => 'https://app.kangaroo-japan.com/api/pay/wepaynotify'
            ];

            if ($tradeType == 'JSAPI') {
                $weAppInfo = Db::name('user_wechat')
                    ->where('uid', $this->uid)
                    ->where('type','weapp')
                    ->find();
                $data['openid'] = $weAppInfo['openid'];
            }
            else {
                $data['scene_info'] = json_encode(['h5_info' => ['type' => 'Wap', 'wap_url' => 'http://app.kangaroo-japan.com', 'wap_name' => '青岛袋鼠君']]);
                $data['notify_url'] = 'https://app.kangaroo-japan.com/api/pay/wepaynotify';
            }

            $resArr = $pay->unifiedOrder($data);
           // Db::name('debug_logs')->insert(['content' => is_string($resArr)?$resArr:json_encode($resArr,JSON_UNESCAPED_UNICODE)]);
            if (!is_array($resArr) || strtolower($resArr['return_code']) !== 'success' || strtolower($resArr['result_code']) !== 'success') {
                $this->jerror(isset($resArr['err_code_des']) ? $resArr['err_code_des'] : '支付初始化失败');
            }

            if (isset($resArr['mweb_url'])) {
                $redis = new StRedis();
                $redis->set($data['out_trade_no'], $resArr['mweb_url'], 300);
                $url = sprintf('http://app.kangaroo-japan.com/api/pay/h5pay?no=%s', $data['out_trade_no']);
                $this->jsuccess('ok', ['url' => $url]);
            }
            //-- 生成签名
            $data = [
                'appId' => $resArr['appid'],
                'timeStamp' => time(),
                'nonceStr' => $resArr['nonce_str'],
                'package' => 'prepay_id=' . $resArr['prepay_id'],
                'signType' => 'MD5'
            ];
            $data['sign'] = $pay->MakeSign($data);
            return $this->jsuccess('ok', $data);
        }
        catch (\Exception $e) {
            return $this->jerror('支付初始化失败' . $e->getMessage());
        }
    }

    /**
     * 国外支付
     * @param $payInfo
     * @return \think\response\Json
     */
    private function payClound($payInfo){

//        return $this->jerror('微信暂时关闭，请使用支付宝二维码支付，支付时请关闭定位');
        $payNo = $this->genPayNo($payInfo['id'],$payInfo['pay_out_trade_no']);
        if(!$payNo){
            return $this->jerror('发起支付失败');
        }
        $weAppInfo = Db::name('user_wechat')
            ->where('uid', $this->uid)
            ->where('type','gxsweapp')
            ->order('id desc')
            ->find();
        $pay = new PayClound();
//        $amount = intval($payInfo['total_fee']/floatval($rate));
        $amount = $payInfo['total_fee'];
        if($this->uid == 1){
//            $amount = 1;
        }
        $result = $pay->pay($payNo,$amount,$weAppInfo['openid']);
        if($result['code'] !== '0'){
            Db::name('debug_logs')->insert(['content' => $result['msg']]);
            return $this->jerror($result['msg']);
        }
//        return $this->jerror('支付失败');

        $payData = json_decode($result['data'],true);
        $payParams = json_decode($payData['pay_params'],true);
        $data = [
            'timeStamp' => $payParams['timeStamp'],
            'nonceStr' => $payParams['nonceStr'],
            'package' => $payParams['package'],
            'sign' => $payParams['paySign'],
            'signType' => $payParams['signType']
        ];
        return $this->jsuccess('ok', $data);
    }

    private function genPayNo($id,$payOutTradeNo){
        $model = new PayLogs();
        $payNo = $model->getTradeNo();
        $result = Db::name('pay_log_paynos')
            ->where('out_trade_no',$payNo)
            ->find();
        if($result){
            return false;
        }
        $res = Db::name('pay_log_paynos')
            ->insert(['out_trade_no' => $payNo,'pay_out_trade_no' => $payOutTradeNo,'plid' => $id,'create_time' => time()]);
        if($res){
            return $payNo;
        }
        return false;
    }

    /**
     * 支付宝支付
     *
     * @return void
     */
    private function getAlipay($payInfo)
    {
        $payNo = $this->genPayNo($payInfo['id'],$payInfo['pay_out_trade_no']);
        if(!$payNo){
            return "";
        }
        $pay = new PayClound();
//        $rate = config('config.WECHAT_PAY_RATE',0);
//        if($rate <=0){
//            return "";
//        }
//        $amount = intval($payInfo['total_fee']/floatval($rate));
        $amount = $payInfo['total_fee'];
        if($this->uid == 1){
//            $amount = 1;
        }
        $result = $pay->pay($payNo,$amount,"",'Alipay+');
        if($result['code'] !== '0'){
            Db::name('debug_logs')->insert(['content' => $result['msg']]);
            return "";
        }

        $payData = json_decode($result['data'],true);
        return $payData['qrcode_url'];
    }

    /**
     * 支付宝支付
     *
     * @return void
     */
    public function alipay()
    {
        $no = input('out_trade_no', '');
        if (empty($no)) {
            exit('支付错误');
        }
        $payInfo = Db::name('pay_logs')
            ->where('pay_out_trade_no', $no)
            ->where('status', 0)
            ->find();
        if (!$payInfo) {
            exit('错误的支付');
        }
        $weAppInfo = Db::name('user_wechat')
            ->where('uid', $this->uid)
            ->where('type','hwweapp')
            ->order('id desc')
            ->find();
        $pay = new PayClound();
        $rate = config('config.WECHAT_PAY_RATE',0);
        if($rate <=0){
            return $this->error('支付发起失败');
        }
        $amount = intval($payInfo['total_fee']/floatval($rate));
        $result = $pay->pay($payInfo['pay_out_trade_no'],$amount,$weAppInfo['openid'],'Alipay+');
        if($result['code'] !== '0'){
            Db::name('debug_logs')->insert(['content' => $result['msg']]);
            return $this->jerror($result['msg']);
        }

        $payData = json_decode($result['data'],true);
        $payParams = json_decode($payData['pay_original_response'],true);
        $qrcodeUrl = $payParams['orderCodeForm']['codeDetails'][1]['codeValue'];
        header('Location:'.$qrcodeUrl);
        exit();
        $data = [
            'timeStamp' => $payParams['timeStamp'],
            'nonceStr' => $payParams['nonceStr'],
            'package' => $payParams['package'],
            'sign' => $payParams['paySign'],
            'signType' => $payParams['signType']
        ];
        return $this->jsuccess('ok', $data);
//        try {
//            $params = new PayParams();
//            $params->addGoods($no, $payInfo['goods_name'], 1, $payInfo['total_fee']);
//            $params->setOutTradeNo($payInfo['pay_out_trade_no']);
//            $params->setTotalAmount($payInfo['total_fee']);
//            $params->setSubject($payInfo['goods_name']);
//            $params->setBody($payInfo['goods_name']);
//            $content = $params->getBizContent();
//            $config = config('app.alipay');
//            $pay = new H5Alipay($config);
//            $arr = $pay->execute($content);
////            header("Content-type: text/html; charset=gb2312");
//            echo $arr;
//            exit();
//        }
//        catch (\Exception $e) {
//            exit($e->getMessage());
//        }
    }
}