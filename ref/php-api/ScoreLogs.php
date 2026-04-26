<?php
namespace app\common\model;

use think\Model;

class ScoreLogs extends Model
{
    protected $table = 'st_score_log';


    public static $TYPE_RECHARGE = 1;
    public static $TYPE_OPEN = 2;


    public static function getTypeArr($type=false)
    {
        $typeArr = [
            '1' => '用户充值',
            '2' => '积分转盘',
            '3' => '购买优惠券',
            '4' => '每日登录积分',
        ];
        if($type === false){
            return $typeArr;
        }
        return $typeArr[$type];
    }


    /**
     * 扣是负值，加是正值
     * @param $uid
     * @param $money
     * @param $before
     * @param $type
     * @param $remark
     * @param int $from_user_id
     * @return false
     */
    public static function addLog($uid, $money,$beforeWallet, $type, $remark)
    {
        $model = new ScoreLogs();
        $data = array(
            'uid' => $uid,
            'amount' => $money,
            'type' => $type,
            'remark' => $remark,
            'before_score' => $beforeWallet,
            'after_score' => $beforeWallet + $money,
            'create_time' => time()
        );
        return $model->insert($data);
    }
}