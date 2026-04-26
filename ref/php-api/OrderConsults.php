<?php
/**
 * Created by PhpStorm.
 * Date: 2021/8/28
 * Time: 18:14
 * description:
 */
namespace app\common\model;

use think\Exception;
use think\exception\ValidateException;
use think\Model;

/**
 * 日本网站下单咨询
 */
class OrderConsults extends Model
{
    protected $table = 'st_order_consults';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'uid|用户' => 'require',
        'url|商品链接' => 'require',
        'remark|备注' => 'require',
    ];
    /**
     * 错误提示
     * @var array
     */
    public $errMsg = [];

    /**
     * 新增和编辑
     * @param $params
     * @return array
     */
    public function addRow($params){
        try{
            \validate($this->rules,$this->errMsg)->failException(true)->check($params);
            $allowField = ['uid','url','remark'];
            $data = filter_data($params,$allowField);
            if(mb_strlen($data['url']) > 256){
                return [1,'链接长度不得超过256个字符'];
            }
            if(mb_strlen($data['remark']) > 200){
                return [1,'链接长度不得超过200个字符'];
            }
            $data['update_time'] = time();
            $data['create_time'] = time();
            $res = $this
                ->insert($data,true);
            if($res){
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