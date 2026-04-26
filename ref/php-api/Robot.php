<?php
/**
 * Created by PhpStorm.
 * Date: 2021/10/9
 * Time: 2:51 PM
 */

namespace app\api\controller;

use app\common\facade\StRedis;
use app\common\library\Wecom;
use app\common\logic\MnpAlertLogic;
use app\common\logic\UserLogic;
use app\common\model\Configs;
use app\common\model\OrderModel;
use think\App;
use think\facade\Db;

class Robot extends Base
{
    public function __construct(App $app)
    {
        $allow = [
            'https://jp.mercari.com',
            'https://safekey-1.americanexpress.com',
        ];
        $referer = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (in_array($referer, $allow)) {
            header('Access-Control-Allow-Origin:' . $referer);
            header('Access-Control-Allow-Credentials: true');
            header("Access-Control-Allow-Headers: Origin, Content-Type, Cookie, X-CSRF-TOKEN, Accept, Authorization, X-XSRF-TOKEN, x-requested-with");
            header('Access-Control-Allow-Methods: GET, POST, PUT,DELETE,OPTIONS,PATCH');
        }
        $this->noNeedLogin = ['*'];
        $this->noNeedLogin = ['*'];
        parent::__construct($app);
    }

    public function utest(){
        //-- 公众号提醒
        MnpAlertLogic::addAlertMsg('yahoobid',1,['order_id' => 21443]);
        return "success";
    }

    /**
     * 获取账号
     */
    public function accounts()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('错误的请求');
        }
        $sign = input('sign', '');
        if ($sign !== 'daishujun_japan_1009') {
            return $this->jerror('签名错误');
        }
        $list = Db::name('yahoo_accounts')
            ->column('account');
        return $this->jsuccess('ok', $list);
    }

    public function setcookies()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('错误的请求');
        }
        $sign = input('sign', '');
        if ($sign !== 'daishujun_japan_1009') {
            return $this->jerror('签名错误');
        }
        $account = input('account', '');
        $cookies = input('cookies', '');
        if (empty($account) || empty($cookies)) {
            return $this->jerror('设置失败');
        }
        $info = Db::name('yahoo_accounts')
            ->where('account', $account)
            ->find();
        if (!$info) {
            return $this->jerror('该账号不存在');
        }
        $res = Db::name('yahoo_accounts')
            ->where('account', $account)
            ->save(['cookies' => $cookies, 'login_status' => 1, 'last_login_time' => time(), 'update_time' => time()]);
        if ($res) {
            return $this->jsuccess('更新成功');
        }
        return $this->jerror('更新失败');
    }

    public function setmercari()
    {
        if (!$this->request->isPost()) {
            return $this->jerror('错误的请求');
        }
        $fields = [
            'index' => 'MERCARI_INDEX_TOKEN',
            'search' => 'MERCARI_SEARCH_TOKEN',
            'detail' => 'MERCARI_DETAIL_TOKEN',
            'profile' => 'MERCARI_PROFILE_TOKEN',
            'shop_goods_detail' => 'shop_goods_detail',
        ];
        $type = input('type', '');
        $dpop = input('dpop', '');
        if (!isset($fields[$type])) {
            return $this->jerror('type error');
        }
        if (empty($dpop)) {
            return $this->jerror('dpop error');
        }
        $result = Db::name('mercari_dpops')->where('type',$type)->where('dpop','Dpop: '.$dpop)->find();
        if($result){
            return $this->jerror('dpop error');
        }

        Db::name('mercari_dpops')
            ->insert(['type' => $type,'dpop' => 'Dpop: '.$dpop,'create_time' => time()]);
        $model = new Configs();
        $res = $model
            ->where('name', $fields[$type])
            ->save(['value' => 'dpop: '.trim($dpop),'update_time' => time()]);
        if (!$res) {
            return $this->jerror('update error');
        }
        Configs::clearCache();
        return $this->jsuccess('update success');
    }


    public function gettask(){
        if (!$this->request->isPost()) {
            return $this->jerror('错误的请求');
        }
        $status = config('config.AUTO_STATUS',0);
        if(intval($status) != 1){
            return $this->jerror('暂时没有购买任务');
        }
        $sign = input('sign', '');
        if ($sign !== 'ZfiCHXeORh8sPupTAwzxM3VGJrYB6yEt') {
            return $this->jerror('签名错误');
        }
        (new Configs())->where('name','AUTO_BUY_HEART')->update(['value' => date('Y-m-d H:i:s',time())]);
        $redis = new \Tools\StRedis();
        $key = 'auto_buy_goods';
        $json = $redis->get($key);
        $goodsNos = empty($json)?[0]:json_decode($json,true);
        //-- 读取待入库的商品
        $info = (new OrderModel())
            ->whereNotIn('ext_goods_no',$goodsNos)
            ->where('is_auto_buy',1)
            ->where('status','in',[0,1,2])
            ->where('shop','mercari')
            ->field('id,ext_goods_no,price')->order('id desc')->find();
        if(!$info){
            $this->jerror('没有新的任务');
            //return $this->queryorder();
        }
        $goodsNos[] = $info['ext_goods_no'];
        $redis->set($key,json_encode($goodsNos));
        if(!empty($json)){
            $redis->expire($key,600);
        }
        return $this->jsuccess('ok',['goods_no' => $info['ext_goods_no'],'goods_price' => $info['price'],'task_type' => 'add_order']);
    }

    public function queryorder(){
        if (!$this->request->isPost()) {
            return $this->jerror('错误的请求');
        }
        $sign = input('sign', '');
        if ($sign !== 'ZfiCHXeORh8sPupTAwzxM3VGJrYB6yEt') {
            return $this->jerror('签名错误');
        }
        
        $key = 'last_query_postcode_order';
        $redis = new \Tools\StRedis();
        $lastId = $redis->get($key);
        $info = (new OrderModel())
            ->where('id','>',intval($lastId))
            ->where('status',2)
            ->where('shop','mercari')
            ->where('create_time','between',[time()-5*86400,time() - 3600])
            ->whereRaw("`postcode` = '' or `postcode` is NULL")
            ->field('id,ext_goods_no')
            ->order('id asc')->find();
        if(!$info){
            return $this->jerror('暂时没有任务');
        }
        $redis->set($key,$info['id'],600);
        $redis->expire($key,600);
        return $this->jsuccess('ok',['goods_no' => $info['ext_goods_no'],'task_type' => 'query_postcode']);
    }



    public function donetask(){
        if (!$this->request->isPost()) {
            return $this->jerror('错误的请求');
        }
        $status = config('config.AUTO_STATUS',0);
        if(intval($status) != 1){
            return $this->jerror('操作失败');
        }
        $sign = input('sign', '');
        if ($sign !== 'ZfiCHXeORh8sPupTAwzxM3VGJrYB6yEt') {
            return $this->jerror('签名错误');
        }
        $goodsNo = input('goods_no','');
        if(empty($goodsNo)){
            return $this->jerror('商品编号不能为空');
        }
        if($goodsNo == "check"){
            //-- 发送提醒
            $msgArr = [
                '自动购买脚本需要手动验证',
            ];
            $alertModel = new Wecom();
            $alertModel->toGroup($alertModel->orderUrl,'自动购买验证提醒',$msgArr);
            return $this->jerror('需要验证');
        }
        //-- 读取待入库的商品
        $model = new OrderModel();

        $taskType = input('task_type','add_order');
        if($taskType == 'query_postcode'){
            $info = $model->where('shop','mercari')->where('status',2)->where('ext_goods_no',$goodsNo)->find();
            if(!$info){
                return $this->jerror('该订单不存在');
            }
            //-- 快递单号
            $code = input('code','');
            if(empty($code)){
                return $this->jerror('快递单号不能为空');
            }
            $data = [
                'postcode' => trim($code),
                'update_time' => time()
            ];
            $res = $model->where('id',$info['id'])->update($data);
            if(!$res){
                return $this->jerror('更改状态失败');
            }
            OrderModel::addLog(0, 1, $info['id'], '对订单进行同步快递单号操作', '');
            return $this->jsuccess('操作成功');
        }

        $info = $model->where('is_auto_buy',1)->where('shop','mercari')->where('ext_goods_no',$goodsNo)->find();
        if(!$info){
            return $this->jerror('该订单不存在');
        }
        $step = input('status',2);
        if(!in_array($step,[2,3,4,5,6,7])){
            return $this->jerror('状态参数错误');
        }
        $model->startTrans();
        try {
            $data = [
                'is_auto_buy' => $step,
                'update_time' => time()
            ];
            if($step == 2){
                $data['status'] = $info['status'] ==1?2:$info['status'];
            }
            $res = $model->where('id',$info['id'])->update($data);
            if(!$res){
                throw new \Exception('更改状态失败');
            }
            OrderModel::addLog(0, 1, $info['id'], $step==2?'对订单进行了购买操作':'对订单进行了取消操作', '');
            $model->commit();
            if($step != 2){
                $alertModel = new Wecom();
                $msgArr = [
                    3 => '该商品已售',
                    4 => '卖家被封号',
                    5 => '该商品已删除',
                    6 => '该商品需要输入验证码',
                    7 => '已被卖家拉黑',
                ];
                if(in_array($step,[4,7])){
                    $blackData = [
                        'seller' => $info['seller'],
                        'seller_id' => $info['seller_id']
                    ];
                    Db::name('mercari_blacklist')->insert($blackData);
                }

                //-- 发送提醒
                $msgArr = [
                    '商品号:'.$goodsNo,
                    '商品名称:'.$info['goods_name'],
                    '备注:'.$msgArr[$step]
                ];
                $alertModel->toGroup($alertModel->orderUrl,'自动购买失败',$msgArr);
            }
            return $this->jsuccess('操作成功');
        }catch (\Exception $e){
            $model->rollback();
            return $this->jerror($e->getMessage());
        }

    }
}