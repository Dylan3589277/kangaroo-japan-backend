<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/6
 * Time: 21:10
 * description:
 */
namespace app\common\model;

use think\Exception;
use think\exception\ValidateException;
use think\Model;

class Coupons extends Model
{
    protected $table = 'st_coupons';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'name|名称' => 'require',
        'type|类型' => 'require',
        'order_type|适用类型' => 'require',
        'icon|图标' => 'require',
        'condition|满足条件' => 'number'
    ];

    /**
     * 错误提示
     * @var array
     */
    public $errMsg = [];


    public static function getActType($type=false){
        $arr = [
            'none' => '不参与活动',
            'regist' => '新人注册优惠券',
            'invite' => '邀请注册得优惠券',
            'buy' => '购买x日元奖励',
            'continuous_buy' => '连续购买x单奖励',
            'clear_store' => '清空仓库奖励',
            'home' => '首页免费领取',
        ];
        if($type === false){
            return $arr;
        }
        return $arr[$type]??'--';
    }

    /**
     * 新增和编辑
     * @param $params
     * @return array
     */
    public function addRow($params){
        try{
            \validate($this->rules,$this->errMsg)->failException(true)->check($params);
            $allowField = ['name','icon','type','order_type','act_type','act_extras','condition','data','expire_days','stock','canbuy','score'];
            $data = filter_data($params,$allowField);

            if($data['data'] <=0){
                return [1,'赠送优惠不能为空'];
            }

            if($data['data'] > 1 && $data['type'] == 'rate'){
                return [1,'折扣券不能大于1'];
            }

            //-- 活动营销
            if(!empty($data['act_type'])){
                $actForm = json_decode($data['act_extras'],true);
                if($data['act_type'] == 'buy' && intval($actForm['amount']) <=0){
                    return [1,'请输入活动订单购买金额'];
                }
                if($data['act_type'] == 'continuous_buy' && (intval($actForm['number']) <=0 || empty($actForm['start_date']) || intval($actForm['day'])<=0)){
                    return [1,'请输入活动连续购买次数、开始时间、天数'];
                }
            }


            $id = isset($params['id'])?intval($params['id']):0;
            if($id>0){
                $data['update_time'] = time();
                $info = $this->where(['id' => $id,'is_deleted' => 0])->find();
                if(!$info){
                    return [1,'该记录不存在'];
                }
                $res = $info->save($data);
            }else{
                $data['create_time'] = time();
                $res = $this
                    ->insert($data);
            }
            if($res !== false){
                return [0,'操作成功'];
            }
            return [1,'操作失败请稍后再试'];
        }catch (ValidateException $e){
            return [1,$e->getMessage()];
        }catch (Exception $e){
            return [1,$e->getMessage()];
        }
    }

}