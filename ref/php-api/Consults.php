<?php
namespace app\api\controller;
use app\api\controller\Base;
use app\common\library\Wecom;
use app\common\model\OrderConsults;
use think\App;

class Consults extends Base
{
    public function __construct(App $app)
    {
        parent::__construct($app);
    }

    /**
     * 提交需求咨询
     */
    public function submit(){
        //-- 检测未处理的咨询
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }
        $model = new OrderConsults();
        $count = $model->where('uid',$this->uid)->where('status',0)->count();
        if($count >= 3){
            return $this->jerror('你还有未处理的咨询，请耐心等待');
        }
        //-- 录入
        $params = input('post.','');
        $params['uid'] = $this->uid;
        list($err,$result) = $model->addRow($params);
        if($err != 0){
            return $this->jerror($result);
        }
        try {
            $alertModel = new Wecom();
            //-- 发送提醒
            $msgArr = [
                '链接:'.$params['url'],
                '备注:'.$params['remark']
            ];
            $alertModel->toGroup($alertModel->orderUrl,'代拍咨询',$msgArr);
        }catch (\Exception $e){

        }

        return $this->jsuccess('提交成功');
    }

    /**
     * 历史录入
     */
    public function lists(){
        $model = new OrderConsults();
        $result = $model
            ->where('uid',$this->uid)
            ->order('id desc')
            ->field('id,uid,url,remark,result,status,order_id')
            ->paginate(true)->toArray();
        return $this->jsuccess('ok',['list' => $result['data']??[],'total' => intval($result['total'])]);
    }

    /**
     * 取消咨询
     */
    public function cancel(){
        if(!$this->request->isPost()){
            return $this->jerror('method error');
        }
        $model = new OrderConsults();
        $id = input('id','');
        $info = $model->where('id',intval($id))
            ->where('uid',$this->uid)
            ->where('status',0)
            ->find();
        if(!$info){
            return $this->jerror('该记录不存在或已处理');
        }
        $res = $info->save(['status' => -1]);
        if($res){
            return $this->jsuccess('操作成功');
        }
        return $this->jerror('操作失败，请稍后再试');
    }

}