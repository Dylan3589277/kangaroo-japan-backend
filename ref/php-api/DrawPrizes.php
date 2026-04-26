<?php

namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\facade\Db;
use think\helper\Str;
use think\Model;
use think\Validate;

class DrawPrizes extends Model
{
    protected $table = 'st_draw_prizes';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public $rules = [
        'did|转盘' => 'require',
        'rate|公开概率' => 'require',
        'name|名称' => 'require',
        'cover|图标' => 'require',
        'number|数量' => 'require',
        'left_number|剩余数量' => 'require'
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
            $allowField = ['prize', 'did','name', 'number','type', 'left_number','cover','rate'];
            $data = filter_data($params, $allowField);
            $id = isset($params['id']) ? intval($params['id']) : 0;

            if ($id > 0) {
                $info = $this
                    ->where('id', $id)
                    ->find();
                if (!$info) {
                    return [1, '该规格不存在'];
                }

                $data['is_deleted'] = 0;
                $data['update_time'] = time();
                $res = $info->save($data);
            } else {
                $data['update_time'] = time();
                $data['create_time'] = time();
                $res = $this
                    ->insert($data, true);
            }

            if ($res !== false) {
                return [0, $id > 0 ? $id : $res];
            }
            return [1, '操作失败请稍后再试'];
        } catch (ValidateException $e) {
            return [1, $e->getMessage()];
        } catch (Exception $e) {
            return [1, $e->getMessage()];
        }
    }


}