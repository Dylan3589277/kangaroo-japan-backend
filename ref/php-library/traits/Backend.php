<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/1
 * Time: 00:05
 * description:
 */

namespace app\common\library\traits;
use think\facade\Db;
use think\facade\View;

trait Backend
{
    use Base;
    /**
     * 编辑
     * @param $model
     * @return \think\response\Json
     */
    protected function editRow($model=null, $tpl = 'form', $delfield = 'is_deleted')
    {
        if ($this->request->isPost()) {
            $params = $this->request->post();
            list($errcode, $result) = $model->addRow($params);
            if ($errcode != 0) {
                Db::name('debug_logs')->insert(["content" => $result]);
                return $this->jerror($result);
            }
            return $this->jsuccess('编辑成功');


        }
        $id = $this->request->param('id', '');
        if (empty($id)) {
            $this->error('参数错误,id为必选项');
        }
        $info = $model->where(['id' => intval($id), $delfield => 0])->find();
        if (!$info) {
            $this->error('该记录不存在');
        }
        View::assign('info', $info);
        return view($tpl);
    }

    /**
     * 新增
     * @param $model
     * @return \think\response\Json
     */
    protected function addRow($model=null, $tpl = 'form')
    {
        if ($this->request->isPost()) {
            $params = $this->request->post();
            list($errcode, $result) = $model->addRow($params);
            if ($errcode != 0) {
                return $this->jerror($result);
            }
            return $this->jsuccess('新增成功');
        }
        return view($tpl);
    }

    /**
     * 开关
     * @param $model
     * @param string $key
     * @param string $fields
     * @return \think\response\Json
     */
    protected function switch ($model=null, $key = 'id', $fields = 'status')
    {
        $id = $this->request->post($key);
        if (empty($id)) {
            return $this->jerror('参数异常');
        }
        $id = $key=='id'?intval($id):$id;
        $info = $model->where([$key => $id])->find();
        if (!$info) {
            return $this->jerror('该记录不存在');
        }
        $res = $info->save([$fields => $info[$fields] == 1 ? 0 : 1]);
        if ($res !== false) {
            return $this->jsuccess('操作成功');
        }
        return $this->jerror('操作失败，请稍后再试');
    }

    /**
     * 删除操作
     * @param $model
     * @param string $key
     * @param string $field
     * @return \think\response\Json
     */
    protected function delete($model=null, $key = 'id', $field = 'is_deleted')
    {
        $id = $this->request->post($key);
        if (empty($id)) {
            return $this->jerror('参数异常');
        }
        if ($field) {
            //-- 软删除
            $res = $model->where([$key => intval($id)])->save([$field => 1]);
        } else {
            $res = $model->where([$key => intval($id)])->delete();
        }
        if ($res !== false) {
            return $this->jsuccess('删除成功');
        }
        return $this->jerror('删除失败，请稍后再试');
    }


}