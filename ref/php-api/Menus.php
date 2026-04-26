<?php
/**
 * Created by PhpStorm.
 * Date: 2020/12/2
 * Time: 23:21
 * description:
 */

namespace app\common\model;

use think\db\Query;
use think\Exception;
use think\exception\ValidateException;
use think\helper\Str;
use think\Model;
use think\Validate;

class Menus extends Model
{
    protected $table = 'st_menu';

    protected $autoWriteTimestamp = true;
    /**
     * 验证规则
     * @var array
     */
    public  $rules = [
        'title|名称' => 'require',
        'url|路径' => 'require',
        'icon|图标' => 'require',
        'pid|上级' => 'number',
        'hide|是否隐藏' => 'number',
        'sort|排序' => 'number'
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
            $params['url'] = strtolower($params['url']);
            $allowField = ['title','url','icon','pid','hide','sort','tip'];
            $data = filter_data($params,$allowField);
            $id = isset($params['id'])?intval($params['id']):0;
            //-- 判断路径是否存在
            $exist = $this
                ->where('id','<>',$id)
                ->where('url','=',$data['url'])
                ->find();
            if($exist){
                return [1,'该路径已存在'];
            }
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

    /**
     * 获取顶级菜单
     * @return array
     */
    public function getParentList(){
        return $this
            ->where(['pid' => 0,'hide' => 0,'is_deleted' => 0])
            ->field('id,title,url')
            ->order('sort desc,id asc')
            ->select()->toArray();
    }


    /**
     * 获取菜单
     * @param $rid
     * @param $path
     * @return mixed
     */
    public function getMenu($rid, $path)
    {
        $map = [['is_deleted','=',0]];
        if($rid){
            $rmodel = new Roles();
            $rinfo = $rmodel->where(['id' => $rid])->find();
            if(!$rinfo || empty($rinfo['rules'])){
                throw  new \think\Exception('权限异常,请检查后重试');
            }
            $map[] = ['id','in',explode(',',$rinfo['rules'])];
        }

        //#TODO 缓存
        //-- 获取所有的菜单
        $menuList = $this->where($map)->order('pid asc,sort desc')->select()->toArray();
        $menuArr = [];
        $pid = 0;
        $isExist = false;
        //-- 遍历处理
        foreach ($menuList as $item) {
            $item['active'] = 0;
            if (strtolower($item['url']) == strtolower($path)) {
                $item['active'] = 1;
                $pid = $item['pid'];
                $isExist = true;
            }
            if($item['hide'] != 0){
                continue;
            }
            $item['url'] = empty($item['url'])?'':(string)url(strtolower($item['url']));
            $menuArr[$item['pid']][] = $item;
        }
        if(!$isExist && $rid != 0){
            throw  new \think\Exception('你没有访问权限，请检查后重试');
        }
        $pidArr = isset($menuArr[0])?$menuArr[0]:[];
        foreach ($pidArr as &$pitem) {
            if(!$pitem['active']){
                $pitem['active'] = $pitem['id'] == $pid ? 1 : 0;
            }
            $pitem['childs'] = isset($menuArr[$pitem['id']]) ? $menuArr[$pitem['id']] : [];
        }
        return $pidArr;
    }
}