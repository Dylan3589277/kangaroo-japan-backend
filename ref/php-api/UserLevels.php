<?php
/**
 * Created by PhpStorm.
 * Date: 2021/8/29
 * Time: 15:50
 * description:
 */
namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use think\Validate;

class UserLevels extends Model
{
    protected $table = 'st_user_levels';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'name|账号' => 'require',
    ];
    /**
     * 错误提示
     * @var array
     */
    public $errMsg = [
    ];

    /**
     * 新增和编辑
     * @param $params
     * @return array
     */
    public function addRow($params){
        try{
            \validate($this->rules,$this->errMsg)->failException(true)->check($params);
            $allowField = [
                'name',
                'rate',
                'ship_rate',
                'store_days',
                'price',
                'fee',
                'over_time_fee',
                'privilege'
            ];
            $data = filter_data($params,$allowField);
            $id = isset($params['id'])?intval($params['id']):0;
            if($id>0){
                $info = $this->where(['id' => $id,'is_deleted' => 0])->find();
                if(!$info){
                    return [1,'该记录不存在'];
                }
                $res = $info->save($data);
            }else{
                $res = $this
                    ->save($data);
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