"""Check account-only storage and bounded authentication hover/focus labels."""
import os,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('TEST_URL','http://127.0.0.1:3200')
shots=Path(os.environ.get('SCREENSHOT_DIR','/workspace/scratch/storage-auth-screens'));shots.mkdir(parents=True,exist_ok=True)
def check_button(button):
    assert button.evaluate('e=>e.scrollWidth<=e.clientWidth&&e.scrollHeight<=e.clientHeight')
    assert button.evaluate('''e=>{
      const b=e.getBoundingClientRect();
      const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);
      let node;while(node=walker.nextNode())if(node.textContent.trim()){
        const range=document.createRange();range.selectNodeContents(node);
        for(const r of range.getClientRects())if(r.left<b.left+10||r.right>b.right-10||r.top<b.top+4||r.bottom>b.bottom-4)return false;
      }return true;
    }'''),button.inner_text()
def check_page(page):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),page.viewport_size
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium')
    errors=[]
    for width,height in [(320,568),(360,740),(375,667),(390,844),(430,932),(480,960),(768,1024),(1280,900),(1920,1080)]:
        context=browser.new_context(viewport={'width':width,'height':height});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base)
        for theme in ['light','dark']:
            if theme=='dark':page.get_by_role('button',name='Переключить тему',exact=True).click()
            for name in ['Войти','Создать семейный архив']:
                page.get_by_role('button',name=name,exact=True).first.hover();check_button(page.get_by_role('button',name=name,exact=True).first)
            page.get_by_role('button',name='Создать семейный архив',exact=True).click()
            for mode in ['register','login']:
                expect(page.locator('html')).to_have_attribute('data-theme',theme)
                for button in page.locator('.auth-actions button').all():
                    button.hover();check_button(button);check_page(page)
                    button.focus();check_button(button)
                page.screenshot(animations='disabled',path=str(shots/f'{width}-{mode}-hover-{theme}.png'))
                if mode=='register':page.locator('.auth-actions .text-button').click()
            # Enlarged text must wrap inside the same buttons.
            style=page.add_style_tag(content='.auth-actions > button {font-size:28px}')
            page.locator('.auth-actions .text-button').hover()
            for button in page.locator('.auth-actions button').all():check_button(button)
            check_page(page);style.evaluate('e=>e.remove()')
            page.get_by_role('button',name='Закрыть',exact=True).click()
        print('PASS auth hover/focus, both modes/themes and enlarged text',width,flush=True);context.close()
    context=browser.new_context(viewport={'width':1280,'height':900});page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    assert context.request.post(base+'/api/auth/register',data={'name':'Проверка хранилища','email':'storage-'+str(time.time_ns())+'@example.test','password':'testing-password'}).status==201
    page.goto(base+'/settings')
    expect(page.locator('.storage-link strong')).to_have_text('0 Б');expect(page.locator('.storage-link')).to_contain_text('Архив пуст');expect(page.locator('.storage-total > strong')).to_have_text('0 Б')
    assert page.locator('[role=meter],.storage-meter,.storage-line').count()==0
    expect(page.locator('.storage-detail')).not_to_contain_text('На диске')
    for width in [320,375,430,1280,1920]:
        page.set_viewport_size({'width':width,'height':900});check_page(page);page.locator('#storage').scroll_into_view_if_needed();page.screenshot(animations='disabled',path=str(shots/f'{width}-empty-storage.png'))
    page.set_viewport_size({'width':1280,'height':900});page.locator('.upload-top').click();page.locator('dialog input[type=file]').set_input_files('public/assets/1.jpg');expect(page.locator('.queue-row.saved')).to_have_count(1,timeout=20000);page.get_by_role('button',name='Готово',exact=True).click()
    expect(page.locator('.storage-link strong')).not_to_have_text('0 Б');expect(page.locator('.storage-link')).to_contain_text('1 фото')
    info=context.request.get(base+'/api/storage').json();assert info['used']==info['originals']+info['thumbnails']+info['previews'];assert 'free' not in info and 'total' not in info
    page.locator('#storage').scroll_into_view_if_needed();page.screenshot(animations='disabled',path=str(shots/'filled-storage.png'))
    image=context.request.get(base+'/api/state').json()['media'][0]['id']
    assert context.request.post(base+'/api/media/batch',data={'ids':[image],'action':'trash'}).ok
    page.reload();expect(page.locator('.storage-link')).to_contain_text('Файлы в корзине');expect(page.locator('#storage a[href="/trash"]')).to_be_visible()
    assert context.request.post(base+'/api/media/batch',data={'ids':[image],'action':'permanent'}).ok
    page.reload();expect(page.locator('.storage-link strong')).to_have_text('0 Б');expect(page.locator('.storage-total > strong')).to_have_text('0 Б')
    assert not errors,errors
    browser.close();print('PASS empty/upload/trash/delete account storage; no host-disk capacity or fake meter')
