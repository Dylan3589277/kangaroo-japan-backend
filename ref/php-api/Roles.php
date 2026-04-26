<?php
/**
 * Created by PhpStorm.
 * User: standopen
 * Date: 2020/12/3
 * Time: 12:30 PM
 */
namespace app\common\model;

use think\Exception;
use think\exception\ValidateException;
use think\Model;

class Roles extends Model
{
    protected $table = 'st_roles';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'name|名称' => 'require',
        'default_path|默认路径' => 'require',
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
            $allowField = ['name','default_path','remark'];
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