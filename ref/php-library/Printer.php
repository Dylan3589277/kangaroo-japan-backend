<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/26
 * Time: 5:22 PM
 *
 * 用来存放打印队列
 *
 */

namespace app\common\library;

use app\common\model\OrderModel;
use think\facade\Db;
use Tools\StRedis;

class Printer
{

    public function __construct()
    {
    }

    public static function printLabel($orderIdArr)
    {
        $orderList = Db::name('orders')
            ->alias('o')
            ->where('o.id','in',$orderIdArr)
            ->field('o.*,u.nickname,u.mobile,u.code as ucode')
            ->join('st_users u', 'u.id=o.uid', 'LEFT')
            ->select()->toArray();
        if(!$orderList){
            return [1,'参数错误'];
        }

        $params = [];
        foreach ($orderList as $order){
            $params[] = [
                'buyerName' => $order['nickname'],
                'buyerCode' => $order['ucode'],
                'buyerMobile' => $order['mobile'],
                'shopName' => OrderModel::getShopArr($order['shop']),
                'goodsNo' => $order['ext_goods_no'],
                'buyTime' => date('Y/m/d H:i:s',time()),
                'code' => $order['out_trade_no'],
                'buyerRemark' => empty($order['user_remark'])?'':$order['user_remark'],
                'kefuRemark' => empty($order['remark'])?'':$order['remark'],
            ];
        }
        return (new Feieyun())->printLabel($params);
    }

    public static function addQueue($orderId, $mid = 0)
    {
        $order = Db::name('orders')
        ->alias('o')
        ->where('o.id',intval($orderId))
        ->field('o.*,u.nickname,u.mobile,u.code as ucode')
        ->join('st_users u', 'u.id=o.uid', 'LEFT')
        ->find();
        if(!$order){
            return;
        }
        $remark = sprintf('用户:%s;客服:%s',empty($order['user_remark'])?'':$order['user_remark'],empty($order['remark'])?'':$order['remark']);
        $order['remark'] = $remark;
        $order['postcode'] = empty($order['postcode'])?'':$order['postcode'];
        $order['shop'] = OrderModel::getShopArr($order['shop']);
        $order['time'] = date('Y/m/d H:i:s',time());
        $key = 'printer_queue_list_'.$mid;
        $redis = new StRedis();
        $redis->rPush($key, json_encode($order));

    }

    public static function popQueue($mid)
    {
        $key = 'printer_queue_list_'.$mid;
        $redis = new StRedis();
        $len = $redis->lLen($key);
        if (intval($len) <= 0) {
            return false;
        }
        $cache = $redis->lPop($key);
        return is_array($cache) ? $cache : json_decode($cache, true);
    }

}