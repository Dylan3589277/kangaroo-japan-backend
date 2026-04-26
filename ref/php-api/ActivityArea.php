<?php
namespace app\common\model;

use think\Model;

class ActivityArea extends Model
{
    protected $table = 'st_activity_area';
    public function goods(){
        return $this->hasMany(ActivityAreaGoods::class,"area_id")->field('id,area_id,goods_name,ext_goods_no,cover,price');
    }


    public function handleRow($form,$goods){
        $id = $form['id']??0;
        if(empty($form['name']) || empty($form['description'])){
            throw new \Exception('专区名称和描述不能为空');
        }
        if($id > 0){
            $info = $this
                ->where('id',intval($id))
                ->where('is_deleted',0)
                ->find();
            if(!$info){
                throw new \Exception('该专区不存在');
            }
            $res = $info->save(['name' => $form['name'],'description' => $form['description']]);
            if(!$res){
                throw new \Exception('更新失败');
            }
            (new ActivityAreaGoods())->where('area_id',$id)->delete();
        }else{
            $id = $this->insert([
                'name' => $form['name'],
                'description' => $form['description'],
                'create_time' => time()
            ],true);
            if(!$id){
                throw new \Exception('专区新增失败');
            }
        }

        $goodsList = [];

        foreach ($goods as $item){
            if(empty($item['goods_name']) || empty($item['ext_goods_no']) || empty($item['price']) || empty($item['cover'])){
                continue;
            }
            $goodsList[] = [
                'area_id' => $id,
                'ext_goods_no' => $item['ext_goods_no'],
                'price' => $item['price'],
                'cover' => $item['cover'],
                'goods_name' => $item['goods_name'],
            ];
        }
        if(empty($goodsList)){
            throw new \Exception('商品数量不足');
        }
        $res = (new ActivityAreaGoods())->insertAll($goodsList);
        if(!$res){
            throw new \Exception('商品更新失败');
        }

        return true;

    }
}