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
 * 购物分享
 */
class Community extends Model
{
    protected $table = 'st_community';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'uid|用户' => 'require',
        'ship_order_id|出库订单' => 'require',
        'title|标题' => 'require',
        'pictures|图片' => 'require',
        'content|分享内容' => 'require',
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
            $allowField = ['uid','pictures','content','title','ship_order_id'];
            $data = filter_data($params,$allowField);
            $shipOrderExist = (new ShipOrders())
                ->where('uid',$data['uid'])
                ->where('id',$data['ship_order_id'])
                ->count();
            if($shipOrderExist <=0){
                return [1,'该订单不存在'];
            }
            $shareCount = $this->where('uid',$data['uid'])
                ->where('ship_order_id',$data['ship_order_id'])
                ->where('status','in',[0,1])
                ->count();
            if($shareCount > 0){
                return [1,'该订单你已经分享过了'];
            }
            $pictureArr = explode(',',$data['pictures']);
            foreach ($pictureArr as $pic){
                $result = parse_url($pic);
                if(!$result || $result['host'] != 'res.kangaroo-japan.net'){
                    return [1,'请上传正确的截图图片'];
                }
            }
            if(mb_strlen($data['content']) > 200){
                return [1,'分享链接长度不得超过200个字符'];
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