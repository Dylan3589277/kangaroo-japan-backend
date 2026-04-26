<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 15:15
 * description: 雅虎竞拍相关操作
 */
namespace app\api\controller;

use app\common\model\YahooBids;
use think\App;
use think\facade\Db;
use Tools\StRedis;

class Yahoo extends Base
{
    public function __construct(App $app)
    {
        parent::__construct($app);
    }

    public function index()
    {
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }
        $status = input('status','');
        $map = [['uid','=',$this->uid]];
        if($status == 0){
            $map[] = ['status','in',[1]];
        }else if($status == 3){
            $map[] = ['status','in',[0,-1,2]];
        }else{
            $map[] = ['status','in',[3,4]];
        }

        $result = Db::name('yahoo_bids')
            ->where($map)
            ->field('id,status,status_txt,order_id,goods_no,goods_name,cover,price,create_time')
            ->order('id desc')
            ->paginate(10)->toArray();
        $list = $result['data'];
        foreach ($list as &$item){
            $item['shop'] = '雅虎竞拍';
            if($item['status_txt'] == '高値更新'){
                $item['status_txt'] = '竞标失败';
            }else if($item['status_txt'] == '已落扎'){
                $item['status_txt'] = $item['order_id'] > 0?'已下单':'等待客服跟卖家确认运费';
            }
            $item['create_time'] = date('Y/m/d H:i',$item['create_time']);
            //$item['status_txt'] = YahooBids::getStatusArr($item['status']);
        }
        return $this->jsuccess('ok',['list' => $list,'totalPages' => ceil($result['total']/10)]);
    }

    /**
     * 出价
     */
    public function bid(){
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }

        $this->requestLimit();

        $goodsNo = input('goods_no','');
        $price = input('money','');
        if(empty($goodsNo) || $price <=0){
            return $this->jerror('错误的操作');
        }
        $key = sprintf('yahoo_%s',$goodsNo);
        $redis = new StRedis();

        $listJson =  $redis->get('yahoo:goods_list_'.$goodsNo);
        $goodsInfo = empty($listJson)?false:json_decode($listJson,true);
//        if($goodsInfo && $goodsInfo['end_time'] < time()){
//            return $this->jerror('竞拍已结束');
//        }

        //#TODO 结束前五分钟有人投标，清楚缓存，刷新时长
//        if($goodsInfo && $goodsInfo['end_time'] < time() + 300 && $goodsInfo['end_time'] > time()){
//            $redis->del('yahoo:goods_list_'.$goodsNo);
//        }

        $json = $redis->get($key);
        if(empty($json)){
            return $this->jerror('错误的操作');
        }
        $data = is_array($json)?$json:json_decode($json,true);
        if(!$data){
            return $this->jerror('错误的操作');
        }




        if(isset($data['price_title']) && $data['price_title'] == '即決'){
            return $this->jerror('即決商品可以联系客服直接下单购买');
        }
        if($price < $data['bid_price']){
            return $this->jerror('你的出价低于现在最高出价');
        }
        $model = new YahooBids();
        $info = $model
            ->where('uid',$this->uid)
            ->where('goods_no',$goodsNo)
            ->find();
        if($info && $info['status'] == 3){
            return $this->jerror('该商品你已中标');
        }
//        if($info && $info['status'] == 1 && $info['price'] >= $data['bid_price']){
//            return $this->jerror('你现在仍是最高价');
//        }

        if($info && $info['status'] == 1 && $info['price'] < $data['bid_price']){
            $res = $info->save(['status' => 2, 'status_txt' => '高値更新', 'now_price' => $data['bid_price'], 'update_time' => time()]);
        }

        if($info && $price < $info['price']){
            return $this->jerror('出价不能低于现在价格');
        }
        //-- 判断是否有未支付的金额
        $count = Db::name('orders')
            ->where('uid',$this->uid)
            ->where('is_pay',0)
            ->where('status',0)
            ->count();
        if(intval($count) > 0){
            return $this->jerror('你还没有未支付的订单');
        }
        //-- 判断押金
        if($this->userInfo['deposit'] <= 0){
            return $this->jerror('你的押金不足');
        }
        $rate = \think\facade\Config::get('config.YAHOO_DEPOSIT_RATE');
        //-- 判断现在正在竞标的金额
        $amount = $model
            ->where('uid',$this->uid)
            ->where('status','in',[0,1])
            ->where('goods_no','<>',$goodsNo)
            ->sum('price');
        if($this->userInfo['deposit'] * floatval($rate) < (floatval($amount) + floatval($price))){
            return $this->jerror('你的押金不足'.(floatval($amount) + floatval($price)));
        }

        $aList = [];
        if($info && in_array($info['status'],[0,1])){
            $accountInfo =  Db::name('yahoo_accounts')
                ->where('account',$info['account'])
                ->where('login_status',1)
                ->find();
            $aList = [$accountInfo];
        }else{
            //-- 计算出账号
            //-- 已经参与该商品竞标的账号
            $accountList = $model
                ->where('goods_no',$goodsNo)
                ->where('status','in',[0,1])
                ->column('account');
            $aList = Db::name('yahoo_accounts')
                ->where('account','not in',empty($accountList)?[0]:$accountList)
                ->where('login_status',1)
                ->where('status',1)
                ->select()->toArray();
            if(empty($aList)){
                return $this->jerror('当前没有可用的账号，请稍后再试');
            }
            $accountInfo = $aList[0];
        }

        try{
            //-- 记录日志
            $lastReqId = Db::name('yahoo_reqs')->insert([
                'account' => $accountInfo['account'],
                'uid' => $this->uid,
                'goods_no' => $goodsNo,
                'price' => $price,
                'create_time' => time()
            ],true);

            $data = [
                'account' => $accountInfo['account'],
                'uid' => $this->uid,
                'goods_no' => $goodsNo,
                'goods_name' => $data['goods_name'],
                'cover' => $data['cover'],
                'before_price' => $data['bid_price'],
                'seller' => $data['seller'],
                'price' => $price,
                'status_txt' => '准备出价',
                'status' => 0,
                'update_time' => time()
            ];

            if($info){
                $res = $model->where('id',$info['id'])->save($data);
                if(!$res){
                    return $this->jerror('出价失败');
                }
                $bidId = $info['id'];
            }else{
                $data['create_time'] = time();
                $bidId = $model->insert($data,true);
                if(!$bidId){
                    return $this->jerror('出价失败');
                }
            }

            //去出价
            try{
                $api = new \app\common\library\Yahoo();
                $res = false;
                for($index = 0;$index<count($aList);$index++){
                    $accountInfo = $aList[$index];
                    $res = $api->doBid($accountInfo,$goodsNo,$data['price'],$this->uid);
                    if($res !== -1){
                        break;
                    }
                }
                if($lastReqId){
                    Db::name('yahoo_reqs')->where('id',$lastReqId)->update(['account' => $accountInfo['account'], 'result' => $res==200?'出价成功':'出价失败']);
                }

                if($res!==200){
                    throw new \Exception('出价失败');
                }
                $model->where('id',$bidId)->save([
                    'account' => $accountInfo['account'],
                    'status' => 1,
                    'status_txt' => '出价成功',
                    'last_update_time' => time(),
                    'last_update_result' => '出价成功',
                    'last_update_account' => $accountInfo['account'],
                    'last_update_price' => $data['price']
                ]);
                return $this->jsuccess('出价成功');

            }catch (\Exception $e){
                $model->where('id',$bidId)->save([
                    'account' => $info?$info['account']:$accountInfo['account'],
                    'status' => $info?$info['status']:-1,
                    'price' => $info?$info['price']:$data['price'],
                    'status_txt' => $info?$info['status_txt']:'出价失败',
                    'last_update_time' => time(),
                    'last_update_account' => $accountInfo['account'],
                    'last_update_result' => $e->getMessage(),
                    'last_update_price' => $data['price']
                ]);
                return $this->jerror($e->getMessage());
            }
        }catch (\Exception $e){
            return $this->jerror($e->getMessage());
        }

    }

}