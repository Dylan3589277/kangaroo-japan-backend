<?php
namespace app\api\controller;

use app\common\model\Coupons;
use app\common\model\UserModel;
use think\App;
use think\facade\Db;

class Sign extends Base
{
    public function __construct(App $app)
    {
        $this->noNeedLogin = ['index'];
        parent::__construct($app);
    }

    /**
     * 获取签到信息
     */
    public function index()
    {
        //登录状态下获取签到天数
        //获取可以积分兑换的优惠券
        $days = 0;
        $today = false;
        if($this->uid){
            $info = Db::name('user_sign')
                ->where('user_id',$this->uid)
                ->order('id desc')
                ->find();
            if($info){
                //今天已经签到
                if($info['sign_time'] > strtotime(date('Y-m-d'))){
                    $today = true;
                    $days = $info['days'];
                }else if($info['sign_time'] > strtotime('-1 days',strtotime(date('Y-m-d'))) && $info['days'] < 7){
                    //昨天签到了，并且在7天内，可以继续连续续签
                    $days = $info['days'];
                }
            }
        }

        //每天积分配置
        $configs = Db::name('sign_daily')
            ->select()->toArray();
        $continuousScores = [];
        $dailyScore = 0;
        foreach ($configs as $item){
            if($item['type'] == 1){
                $dailyScore = $item['score'];
            }else{
                $continuousScores[$item['days']] = $item['score'];
            }
        }

        $signDays = [];
        for($i=1;$i<=7;$i++){
            $signDays[] = [
                'index' => $i,
                'score' =>$dailyScore + ($continuousScores[$i] ?? 0),
                'signed' => $i<=$days
            ];
        }

        $coupons = (new Coupons())
            ->where('is_deleted',0)
            ->where('canbuy',1)
            ->where('score','>',0)
            ->where('stock','>',0)
            ->field('id,type,name,data,condition,score')
            ->select()->toArray();
        return $this->jsuccess('ok',['days' => $days,'signDays' => $signDays,'today' => $today,'coupons' => $coupons,'myscore' => $this->userInfo['score']]);
    }

    public function sign(){
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }
        $this->requestLimit();
        //获取天数
        //获取配置
        //更新签到记录
        $info = Db::name('user_sign')
            ->where('user_id',$this->uid)
            ->order('id desc')
            ->find();

        if($info && $info['sign_time'] > strtotime(date('Y-m-d'))){
            return $this->jerror('你今天已经签到过了');
        }
        $configs = Db::name('sign_daily')
            ->select()->toArray();
        $dailyScore = 0;
        $continuousScores = [];
        foreach ($configs as $item){
            if($item['type'] == 1){
                $dailyScore = $item['score'];
            }else{
                $continuousScores[$item['days']] = $item['score'];
            }
        }
        if($dailyScore <= 0){
            return $this->jerror('配置异常');
        }
        Db::startTrans();
        try {
            $score = $dailyScore;
            if($info && $info['days'] < 7 && $info['sign_time'] > strtotime('-1 days',strtotime(date('Y-m-d')))){
                $days = $info['days'];
                if(isset($continuousScores[$days+1])){
                    $score += $continuousScores[$days+1];
                }
                //更新签到时间
                $res = Db::name('user_sign')
                    ->where('id',$info['id'])
                    ->update(['sign_time' => time(),'days' => $days+1,'score' => $info['score']+$score]);
            }else{
                //插入记录
                $res = Db::name('user_sign')
                    ->insert([
                        'user_id' => $this->uid,
                        'score' => $score,
                        'days' => 1,
                        'sign_time' => time(),
                        'create_time' => time()
                    ]);
            }

            if(!$res){
                throw new \Exception('更细记录失败');
            }
            $res = UserModel::addScore($this->uid,intval($score),5,'每日签到积分');
            if(!$res){
                throw new \Exception('赠送积分失败');
            }
            Db::commit();
            return $this->jsuccess("每日签到+{$score}积分");
        }catch (\Exception $e){
            Db::rollback();
            return $this->jerror($e->getMessage());
        }
    }
}