<?php
namespace app\common\model;

use think\facade\Db;
use think\Model;

class UserCoupons extends Model
{
    protected $table = 'st_user_coupons';

    protected $autoWriteTimestamp = true;

    public static $SOURCE_REGIST = 1;

    public function addRow($couponInfo,$userInfo,$source=0)
    {
        $data = [
            'uid' => $userInfo['id'],
            'cid' => $couponInfo['id'],
            'code' => getSnowFlakeId(),
            'type' => $couponInfo['type'],
            'order_type' => $couponInfo['order_type'],
            'name' => $couponInfo['name'],
            'icon' => $couponInfo['icon'],
            'condition' => $couponInfo['condition'],
            'data' => $couponInfo['data'],
            'expire' => strtotime('+'.$couponInfo['expire_days'].' day',time()),
            'source' => $source,
            'create_time' => time()
        ];
        $res = $this->insert($data);
        if ($res) {
            Db::name('coupons')
                ->where('id',$data['cid'])
                ->dec('stock',1)
                ->inc('number')->update();
            return $data['code'];
        }
        return false;
    }



}