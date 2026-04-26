<?php
namespace app\common\library;

use app\common\model\Goods;
use app\common\model\OrderModel;
use app\common\model\ShipOrders;
use think\facade\Db;
use Tools\StRedis;

class Wecom
{

//    public  $orderUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=f59b322f-9ad0-4d11-bfca-b7b87b941f2b';
    public  $orderUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=17208cff-44dc-4900-820f-1fb441084170';
//    protected  $shipmentUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=74e6a36b-d27a-49c5-97c2-e3e677743ef4';
    protected  $shipmentUrl = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=0922e366-7116-4bb3-a3a8-577db92c1748';
    public function __construct($url = '')
    {

    }

    public static function sendAlertMsg($title,$msgArr){
        $alertModel = new Wecom();
        $alertModel->toGroup($alertModel->orderUrl,$title,$msgArr);
    }

    public static function addAlertMsg($type,$id){
        $key = 'alert_queue_list';
        $redis = new StRedis();
        $redis->rPush($key, json_encode(['type' => $type,'id' => $id]));
        $redis->pub('alerts','start');
    }

    public  function popQueue()
    {
        $key = 'alert_queue_list';
        $redis = new StRedis();
        $len = $redis->lLen($key);
        if (intval($len) <= 0) {
            var_dump('wecom done');
            return;
        }
        while (true){
            $len = $redis->lLen($key);
            if(intval($len) <=0){
                break;
            }
            $cache = $redis->lPop($key);
            $msgArr =  is_array($cache) ? $cache : json_decode($cache, true);
            switch ($msgArr['type']){
                case 'order':{
                    $this->toNewOrder($msgArr['id']);
                    break;
                }
                case 'shipment':{
                    $this->toShipment($msgArr['id']);
                    break;
                }
                case 'confirm_order':{
                    OrderModel::sendConfirmMsg($msgArr['id']);
                    break;
                }
                case 'confirm_ship_order':{
                    ShipOrders::sendConfirmMsg($msgArr['id']);
                    break;
                }
            }
        }

    }

    private function toNewOrder($id){
        $info = Db::name('orders')
            ->alias('o')
            ->where('o.id',intval($id))
            ->field('o.out_trade_no,o.goods_name,u.nickname,o.shop,o.ext_goods_no,o.create_mid,o.last_update_mid')
            ->join('st_users u','u.id=o.uid','LEFT')
            ->find();
        if(!$info){
            return;
        }

        if($info['create_mid'] >0 || $info['last_update_mid'] >0){
            return;
        }

        $shopName = OrderModel::getShopArr($info['shop']);

        $msgArr = [
            '订单号:'.$info['out_trade_no'],
            '来源:'.$shopName??$info['shop'],
            '用户:'.$info['nickname'],
            sprintf("商品：[%s](%s)",$info['goods_name'],Goods::getUrl($info['shop'],$info['ext_goods_no'])),
        ];
        return $this->toGroup($this->orderUrl,'新支付订单提醒',$msgArr);
    }

    private function toShipment($id){
        $info = Db::name('shipment_orders')
            ->alias('o')
            ->where('o.id',intval($id))
            ->find();
        if(!$info){
            return;
        }

        $msgArr = [
            '订单号:'.$info['out_trade_no'],
            '收货人:'.$info['realname'],
            '备注:'.$info['remark']
        ];
        return $this->toGroup($this->shipmentUrl,'新出库订单提醒',$msgArr);
    }

    public  function toGroup($url,$title,$msgArr){
        $content = sprintf("## %s \n",$title);
        foreach ($msgArr as $msg){
            $content .= ">".$msg."\n";
        }
        $form = [
            'msgtype' => 'markdown',
            'markdown' => [
                'content' => $content,
                'mentioned_list' => ['@all']
            ]
        ];
        $json = json_encode($form,JSON_UNESCAPED_UNICODE);
        $header = ['Content-Type: application/json'];
        $result = request_post($url,$json,false,30,$header,false);
        return $result;
    }
}