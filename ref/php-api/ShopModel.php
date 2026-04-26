<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/6
 * Time: 21:10
 * description:
 */
namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use think\Validate;

class ShopModel extends Model
{
    protected $table = 'st_shops';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'name|标题' => 'require',
        'code|标志' => 'require',
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
                'code',
                'name',
                'icon',
                'cat',
                'is_show',
                'rec',
                'fee',
                'url',
                'description'
            ];
            $data = filter_data($params,$allowField);
            $info = $this->where('code' ,$data['code'])->find();
            if($info){
                $data['is_deleted'] = 0;
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

    /**
     * 获取顶级菜单
     * @return array
     */
    public function getParentList($type){
        return $this
            ->where(['type' => $type,'is_deleted' => 0])
            ->field('id,name,icon')
            ->order('sort desc,id asc')
            ->select()->toArray();
    }

}