<?php
/**
 * Created by PhpStorm.
 * Date: 2021/9/8
 * Time: 16:23
 * description:
 */
namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\facade\Db;
use think\helper\Str;
use think\Model;
use think\Validate;

class AddressModel extends Model
{
    protected $table = 'st_address';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public $rules = [
        'realname|姓名' => 'require',
        'uid|用户' => 'require',
        'mobile|手机号' => 'require',
        'country|国家' => 'require',
//        'city|城市' => 'require',
//        'province|省份' => 'require',
        'address|详细地址' => 'require',
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
    public function addRow($params)
    {
        try {
            \validate($this->rules, $this->errMsg)->failException(true)->check($params);
            $allowField = ['uid','realname', 'mobile', 'address', 'country', 'address', 'province', 'city', 'area', 'postno', 'default'];
            $data = filter_data($params, $allowField);
            if($data['country'] == '中国' && (empty($data['city']) || empty($data['province']))){
                return [1,'请选择城市'];
            }
            Db::startTrans();
            $data['default'] = intval($data['default'])==1?1:0;
            if(intval($data['default']) ==1){
                $res = $this
                    ->where('uid',$data['uid'])
                    ->save(['default' => 0,'update_time' => time()]);
                if($res===false){
                    Db::rollback();
                    return [1,'操作失败'];
                }
            }

            $id = isset($params['id']) ? intval($params['id']) : 0;
            if (intval($id) > 0) {
                $map = [['is_deleted', '=', 0],['uid','=',intval($data['uid'])],['id', '=', $id]];
                $info = $this
                    ->where($map)
                    ->find();
                if(!$info){
                    Db::rollback();
                    return [1,'该记录不存在'];
                }
                $data['update_time'] = time();
                $res = $info->save($data);
            }else{
                $data['update_time'] = time();
                $data['create_time'] = time();
                $res = $this
                    ->insert($data, true);
            }
            if (!$res) {
                Db::rollback();
                return [1, '操作失败请稍后再试'];
            }
            Db::commit();
            return [0, '操作成功'];
        }
        catch (ValidateException $e) {
            return [1, $e->getMessage()];
        }
        catch (Exception $e) {
            return [1, $e->getMessage()];
        }
    }
}