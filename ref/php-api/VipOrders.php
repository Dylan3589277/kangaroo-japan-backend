<?php
namespace app\common\model;

use think\facade\Db;
use think\helper\Str;
use think\Model;

class VipOrders extends Model
{
    protected $table = 'st_vip_orders';

    public static function getTimes(){
        return [
            ['name' => '1个月','month' => 1,'discount' => 1],
            ['name' => '3个月','month' => 3,'discount' => 1],
            ['name' => '6个月','month' => 6,'discount' => 1],
            ['name' => '1年','month' => 12,'discount' => 1],
        ];
    }

    public function addRow($userInfo,$level,$month){
        if($level <=1 || $level<$userInfo['level']){
            throw new \Exception('该等级已解锁,不可续费');
        }
        $levelInfo = Db::name('user_levels')
            ->where('level',$level)
            ->find();
        if(!$levelInfo){
            throw new \Exception('该等级不存在');
        }
        $times = self::getTimes();
        if(!isset($times[$month])){
            throw new \Exception('请选择正确的时长');
        }
        $timeInfo = $times[$month];
        $offsetAmount = 0;
        if($level > $userInfo['level'] && $userInfo['level'] > 1){
            //-- 计算差额
            $curLevelInfo = Db::name('user_levels')
                ->where('level',$userInfo['level'])
                ->find();
            $days = ($userInfo['level_end_time'] - time())/86400;
            $offsetPrice = ($levelInfo['price'] - $curLevelInfo['price'])/30;
            $offsetAmount = intval($days) * $offsetPrice;
        }
        $amount = ($timeInfo['month']*$levelInfo['price']*$timeInfo['discount']+$offsetAmount);

        $data = [
            'level' => $level,
            'level_name' => $levelInfo['name'],
            'uid' => $userInfo['id'],
            'price' => $levelInfo['price'],
            'month' => $timeInfo['month'],
            'amount' => round($amount,2),
            'offset_amount' => $offsetAmount,
            'out_trade_no' => $this->getTradeNo(),
            'level_end_time' => $userInfo['level_end_time'],
            'create_time' => time()
        ];

        $insertId = $this->insert($data,true);
        if(!$insertId){
            throw new \Exception('发起失败');
        }
        $data['id'] = $insertId;
        return $data;
    }

    public static function pay($payInfo,$notifyData){
        $model = new self();
        $info = $model->where('id',intval($payInfo['orders']))->find();
        if(!$info || $info['is_pay'] == 1){
            return;
        }
        $res = $info->save([
            'is_pay' => 1,
            'pay_time' => time()
        ]);
        if(!$res){
            return false;
        }
        $userModel = new UserModel();
        $userInfo = $userModel->where('id',$info['uid'])->find();
        $endTime = $userInfo['level_end_time'] > time()?$userInfo['level_end_time']:time();
        $endTime = strtotime('+'.$info['month'].' month',$endTime);
        return $userInfo->save(['level' => $info['level'],'level_end_time' => $endTime]);
    }

    public function getTradeNo()
    {
        return date('Ymdhis', time()) . Str::random(6, 1);
    }
}