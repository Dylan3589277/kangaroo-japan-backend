<?php
/**
 * Created by PhpStorm.
 * Date: 2021/8/28
 * Time: 18:14
 * description:
 */
namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use think\Validate;

class MercariGoods extends Model
{
    protected $table = 'st_goods_mercaris';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'goods_name|商品名称' => 'require',
        'cover|图片' => 'require',
        'price|价格' => 'require',
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
                'goods_name',
                'cover',
                'description',
                'content',
                'price',
                'imgurls',
                'extras',
                'goods_no',
                'seller',
                'cat',
                'seller_address',
                'seller_id',
                'seller_info',
            ];
            $data = filter_data($params,$allowField);
            if(is_array($data['seller_info'])){
                $data['seller_info'] = json_encode($data['seller_info']);
            }
            $info = $this
                ->where('goods_no','=',$data['goods_no'])
                ->where('is_deleted','=',0)
                ->find();
            if($info){
                $data['update_time'] = time();
                $res = $this->where('id',$info['id'])->update($data);
            }else{
                $data['update_time'] = time();
                $data['create_time'] = time();
                $res = $this
                    ->insert($data,true);
            }

            if($res !== false){
                return [0,$info?$info['id']:$res];
            }
            return [1,'操作失败请稍后再试'];
        }catch (ValidateException $e){
            return [1,$e->getMessage()];
        }catch (Exception $e){
            return [1,$e->getMessage()];
        }
    }

}