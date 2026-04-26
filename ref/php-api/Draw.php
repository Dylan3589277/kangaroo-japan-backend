<?php
namespace app\api\controller;

use app\common\model\UrlModel;
use app\common\model\UserCoupons;
use app\common\model\UserModel;
use think\App;
use think\facade\Db;
use think\facade\View;
use Tools\StRedis;

class Draw extends Base
{
    private $actInfo = false;
    public function __construct(App $app)
    {
        parent::__construct($app);
        $this->checkAct();
        $token = input('token','');
        View::assign('token',$token);
    }

    private function checkAct(){
        $this->actInfo = Db::name('draw_activitys')
            ->where('id',1)
            ->find();
        $this->actInfo['price'] = intval($this->actInfo['price']);
        $this->actInfo['content'] = stripslashes($this->actInfo['content']);
        View::assign('actInfo',$this->actInfo);
    }

    public function index()
    {
        //-- 获取规则
        //-- 获取奖品配置
        $prizeList = $this->getPrizeList();
        if (count($prizeList) > 8) {
            exit('不能超过8个');
        }
        $ggList = $prizeList;
        //-- 凑够8个
        while (count($ggList) < 8) {
            for ($i = count($prizeList) - 1; $i >= 0; $i--) {
                $ggList[] = $prizeList[$i];
                if(count($ggList) >=8){
                    break;
                }
            }
        }
        //打乱
        shuffle($ggList);
        View::assign('gglist', $ggList);
        View::assign('prizeList',$prizeList);
        View::assign('prizejson',json_encode($prizeList,JSON_UNESCAPED_UNICODE));
        return View();
    }

    private function getPrizeList()
    {
        //-- 获取奖品列表
        $prizeList = Db::name('draw_prizes')
            ->where('is_deleted', 0)
            ->field('id as level,rate,name,cover,type')
            ->order('rate asc')
            ->select()->toArray();
        return $prizeList;
    }

    public function dodraw(){
        $uid = $this->uid;
        if($this->userInfo['score'] < $this->actInfo['price']){
            return $this->jerror('剩余积分不足');
        }

        //#TODO 判断运行日期
        //-- 指定日期
        if($this->actInfo['run_type'] == 'year' && date('Y-m-d',time()) != $this->actInfo['rundate']){
            return $this->jerror('抽奖未开放');
        }

        //-- 每月几号
        if($this->actInfo['run_type'] == 'month'){
            $dateArr = explode(',',$this->actInfo['rundate']);
            if(!in_array(date('d',time()),$dateArr)){
                return $this->jerror('抽奖未开放');
            }
        }

        //-- 每周几天
        if($this->actInfo['run_type'] == 'week'){
            $dateArr = explode(',',$this->actInfo['rundate']);
            $week = date('w',time());
            $week = $week ==0?7:$week;
            if(!in_array($week,$dateArr)){
                return $this->jerror('抽奖未开放');
            }
        }

        $prizeList = Db::name('draw_prizes')
            ->where('is_deleted', 0)
            ->order('rate asc')
            ->select()->toArray();

        $totalLeftNum = array_sum(array_column($prizeList,'left_number'));
        if($totalLeftNum <=0){
            $res = Db::name('draw_prizes')
                ->where('is_deleted', 0)
                ->update(['left_number' => Db::raw('number')]);
            if(!$res){
                return $this->jerror('抽奖失败');
            }
            $prizeList = Db::name('draw_prizes')
                ->where('is_deleted', 0)
                ->order('rate asc')
                ->select()->toArray();
        }

        $model = new UserModel();
        try {
            $leftTotalNumber = array_sum(array_column($prizeList, 'left_number'));
            if (intval($leftTotalNumber) <= 0) {
                throw new \Exception('库存不足');
            }

            //-- 将奖品装入箱子
            $drawBox = [];
            foreach ($prizeList as $key => $item) {
                $num = $item['left_number'];
                if ($num <= 0) {
                    continue;
                }
                array_push($drawBox, ...array_pad([], $num, $key));
            }
            if (count($drawBox) < 1) {
                throw new \Exception('库存不足');
            }
            shuffle($drawBox);
            $keyIndex = array_rand($drawBox);
            $propKey = $drawBox[$keyIndex];
            $propInfo = $prizeList[$propKey];

            //-- 开始录入数据库
            $model->startTrans();

            //-- 扣除积分

            $res = UserModel::addScore($uid,$this->actInfo['price']*-1,2,'抽奖扣除');
            if (!$res) {
                throw new \Exception('扣除积分失败，请稍后再试');
            }

            $res = Db::name('draw_prizes')
                ->where('id', $propInfo['id'])
                ->where('left_number','>',0)
                ->inc('sales')
                ->dec('left_number')
                ->update();
            if (!$res) {
                throw new \Exception('抽奖失败，请稍后再试');
            }

            //-- 发放奖品
            switch ($propInfo['type']){
                case "coupon":{
                    $couponInfo = Db::name('coupons')
                        ->where('id',$propInfo['prize'])
                        ->find();
                    $res = (new UserCoupons())->addRow($couponInfo,['id' => $uid],2);
                    break;
                }
                case "score":{
                    $res = UserModel::addScore($uid,$propInfo['prize'],3,'抽奖奖励积分');
                    break;
                }
            }

            if (!$res) {
                throw new \Exception('奖品发放失败');
            }

            //-- 增加记录
            $data = [
                'did' => $this->actInfo['id'],
                'draw_name' => $this->actInfo['name'],
                'draw_price' => $this->actInfo['price'],
                'uid' => $uid,
                'prize' => $propInfo['prize'],
                'type' => $propInfo['type'],
                'name' => $propInfo['name'],
                'cover' => $propInfo['cover'],
                'create_time' => time()
            ];
            $res = Db::name('draw_logs')->insert($data);
            if (!$res) {
                throw new \Exception('增加记录失败');
            }

            $model->commit();

            return $this->jsuccess('ok',['level' => $propInfo['id'],'type' => $propInfo['type']=='none'?3:1,'name' => $propInfo['name'],'picture' => $propInfo['cover'],'href' => '']);

        } catch (\Exception $e) {
            $model->rollback();
            return $this->jerror($e->getMessage().$e->getFile().$e->getLine());
        }


    }

    public function logs(){
        if($this->request->isPost()){
            $result = Db::name('draw_logs')
                ->where('uid',$this->uid)
                ->field('name,cover,create_time')
                ->order('id desc')
                ->paginate(20)->toArray();
            $list = $result['data']??[];
            foreach ($list as &$item){
                $item['time'] = date('Y-m-d H:i:s',$item['create_time']);
            }
            return $this->jsuccess('ok',['list' => $list,'total' => intval($result['total'])]);
        }
        return View();
    }
}