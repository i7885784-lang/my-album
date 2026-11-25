"""Real family workflows plus responsive light/dark screenshots against isolated test storage."""
import os,time,json,sqlite3
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
base=os.environ.get('TEST_URL','http://127.0.0.1:3200')
shots=Path(os.environ.get('SCREENSHOT_DIR','/workspace/scratch/family-features-screens'));shots.mkdir(parents=True,exist_ok=True)
def choose(page,label,option):
    page.get_by_role('button',name=label,exact=True).click()
    page.get_by_role('option',name=option,exact=True).first.click()
def close(page):
    page.locator('dialog[open]').get_by_role('button',name='Закрыть',exact=True).click()
def check(page):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),page.viewport_size
    for box in page.locator('dialog[open],.choice-panel').evaluate_all('nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})'):
        assert box['left']>=-1 and box['right']<=page.viewport_size['width']+1,box
        assert box['top']>=-1 and box['bottom']<=page.viewport_size['height']+1,box
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium')
    context=browser.new_context(viewport={'width':1440,'height':1000},permissions=['notifications'])
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base)
    page.get_by_role('button',name='Создать аккаунт',exact=True).first.click()
    check(page)
    buttons=page.locator('.auth-actions button').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}})')
    assert buttons[0]['right']<=buttons[1]['x'] or buttons[0]['bottom']<=buttons[1]['y']
    page.screenshot(animations="disabled",path=str(shots/'registration-desktop.png'))
    email='feature-owner-'+str(time.time_ns())+'@example.test'
    page.get_by_label('Ваше имя',exact=True).fill('Анна · семейный архив')
    page.locator('dialog').get_by_label('Email',exact=True).fill(email)
    page.locator('dialog').get_by_label('Пароль',exact=True).fill('testing-password')
    page.locator('dialog').get_by_role('button',name='Создать аккаунт',exact=True).click()
    expect(page.locator('.sidebar')).to_be_visible()
    space=page.request.get(base+'/api/state').json()['spaces'][0]['id']
    page.goto(base+'/albums');page.get_by_role('button',name='Создать альбом',exact=True).click()
    page.get_by_label('Название',exact=True).fill('Отпуск · Сочи')
    choose(page,'Место события','Вписать новое место…')
    page.get_by_label('Название нового места',exact=True).fill('Сочи · Ривьера')
    page.get_by_role('button',name='Сохранить',exact=True).click()
    expect(page.locator('.entity-card')).to_have_count(1)
    state=page.request.get(base+'/api/state').json();album=next(e for e in state['entities'] if e['kind']=='albums');place=next(e for e in state['entities'] if e['kind']=='places')
    assert album['place']==place['id']
    page.locator('.entity-card a').click();expect(page.locator('.album-place')).to_have_text('Сочи · Ривьера')
    page.locator('.upload-top').click()
    expect(page.get_by_role('button',name='Альбом',exact=True)).to_contain_text('Отпуск · Сочи')
    with page.expect_file_chooser() as picker:
        page.get_by_role('button',name='Выбрать фото',exact=True).click()
    picker.value.set_files('public/assets/1.jpg')
    expect(page.locator('.queue-row.saved')).to_have_count(1,timeout=20000)
    expect(page.get_by_role('button',name='Альбом',exact=True)).to_be_disabled()
    page.get_by_role('button',name='Готово',exact=True).click()
    state=page.request.get(base+'/api/state').json();image=state['media'][0]['id'];assert place['id'] in state['media'][0]['entities']
    page.locator('.upload-top').click();choose(page,'Место события','Вписать новое место…');page.get_by_label('Название нового места',exact=True).fill('Красная Поляна')
    page.locator('dialog input[type=file]').set_input_files('public/assets/2.jpg')
    expect(page.locator('.queue-row.saved')).to_have_count(1,timeout=20000)
    page.get_by_role('button',name='Готово',exact=True).click()
    state=page.request.get(base+'/api/state').json();assert any(e['name']=='Красная Поляна' for e in state['entities'])
    page.request.patch(base+'/api/media/'+image,data={'favorite':True})
    # Set a historical fixture date in this suite's dedicated local database.
    storage=os.environ.get('TEST_STORAGE','/workspace/scratch/family-features-test')
    db=sqlite3.connect(str(Path(storage)/'albums.sqlite'));today=time.strftime('%m-%d');db.execute("update media set meta=json_set(meta,'$.taken',?) where id=?",('2020-'+today+'T12:00:00.000Z',image));db.commit();db.close()
    child=browser.new_context()
    response=child.request.post(base+'/api/auth/register',data={'name':'Миша','email':'child-'+str(time.time_ns())+'@example.test','password':'testing-password'});assert response.status==201
    child_id=child.request.get(base+'/api/me').json()['id']
    token=page.request.post(base+'/api/invites',data={'space':space,'role':'member'}).json()['token'];assert child.request.post(base+'/api/invites/join',data={'token':token}).ok
    page.goto(base+'/profile')
    page.get_by_role('button',name='Настроить доступ Миша',exact=True).click()
    page.get_by_label('Семейная пометка',exact=True).fill('Ребёнок · Миша')
    choose(page,'Права участника','Только просмотр')
    page.get_by_role('button',name='Скрытые альбомы',exact=True).click();page.get_by_role('option',name='Отпуск · Сочи',exact=True).click();page.keyboard.press('Escape')
    page.get_by_role('button',name='Сохранить доступ',exact=True).click();expect(page.locator('.member-access')).to_have_count(0)
    assert not any(m['id']==image for m in child.request.get(base+'/api/state').json()['media'])
    page.get_by_role('button',name='Настроить доступ Миша',exact=True).click()
    page.get_by_role('button',name='Скрытые альбомы',exact=True).click();page.get_by_role('option',name='Отпуск · Сочи',exact=True).click();page.keyboard.press('Escape');choose(page,'Права участника','Просмотр и свои загрузки');page.get_by_role('button',name='Сохранить доступ',exact=True).click();expect(page.locator('.member-access')).to_have_count(0)
    # Browser notifications require explicit permission and an enabled preference.
    page.goto(base+'/settings')
    expect(page.get_by_text('Распознавание лиц',exact=True)).to_have_count(0)
    expect(page.get_by_text('Геолокация фото',exact=True)).to_have_count(0)
    page.get_by_role('switch',name='Уведомления браузера',exact=True).click()
    page.get_by_role('switch',name='Плавные анимации',exact=True).click()
    page.get_by_role('button',name='Сохранить изменения',exact=True).click();expect(page.locator('.toast')).to_contain_text('Настройки сохранены')
    expect(page.locator('html')).to_have_attribute('data-motion','reduced')
    page.evaluate('''async()=>{await navigator.serviceWorker.register('/sw.js');await navigator.serviceWorker.ready;window.testNotices=[];navigator.serviceWorker.register=async()=>({showNotification:async(title,options)=>window.testNotices.push({title,options})});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})}''')
    # Start a new polling cycle, then a real relative upload creates its server notification.
    page.reload();page.evaluate('''async()=>{await navigator.serviceWorker.ready;window.testNotices=[];navigator.serviceWorker.register=async()=>({showNotification:async(title,options)=>window.testNotices.push({title,options})});Object.defineProperty(document,'hidden',{configurable:true,get:()=>true})}''')
    page.wait_for_timeout(600)
    r=child.request.post(base+'/api/media/upload',multipart={'space':space,'entities':json.dumps([album['id']]),'file':{'name':'Снимок Миши.jpg','mimeType':'image/jpeg','buffer':Path('public/assets/3.jpg').read_bytes()}});assert r.status==201,r.text()
    page.wait_for_function('window.testNotices.length>0',timeout=22000)
    assert page.evaluate('window.testNotices[0].options.body').startswith('Миша')
    print('PASS manual album/upload places, member restrictions, permission-gated notification delivery',flush=True)
    for width,height in [(320,568),(360,740),(375,667),(390,844),(412,915),(430,932),(480,960),(1280,800),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height})
        for theme in ['light','dark']:
            page.goto(base+'/settings');page.get_by_role('button',name='Светлая тема' if theme=='light' else 'Тёмная тема',exact=False).click();expect(page.locator('.theme-status')).to_contain_text('Тема сохранена');check(page);page.screenshot(animations="disabled",path=str(shots/f'{width}-settings-{theme}.png'),full_page=True)
            page.goto(base+'/memories');expect(page.locator('.memory-photo')).to_have_count(1);check(page);page.screenshot(animations="disabled",path=str(shots/f'{width}-memories-day-{theme}.png'),full_page=True)
            for label in ['В этом месяце','Любимые моменты','История по годам']:
                page.locator('.memory-tabs').get_by_role('button',name=label,exact=False).click();expect(page.locator('.memory-photo').first).to_be_visible();check(page)
            page.get_by_role('button',name='Год воспоминаний',exact=True).click();page.get_by_role('option',name='2020',exact=True).click();expect(page.locator('.memory-photo')).to_have_count(1)
            page.locator('.memory-photo').click();expect(page.locator('dialog[open]')).to_be_visible();check(page);close(page)
            page.goto(base+'/albums');page.get_by_role('button',name='Создать альбом',exact=True).click();choose(page,'Место события','Вписать новое место…');check(page);page.screenshot(animations="disabled",path=str(shots/f'{width}-album-place-{theme}.png'));page.get_by_role('button',name='Отмена',exact=True).click()
            page.locator('.upload-top').click();choose(page,'Место события','Вписать новое место…');check(page);page.screenshot(animations="disabled",path=str(shots/f'{width}-upload-place-{theme}.png'));close(page)
            page.goto(base+'/profile');page.get_by_role('button',name='Настроить доступ Миша',exact=True).click();page.locator('.member-access').scroll_into_view_if_needed();check(page);page.screenshot(animations="disabled",path=str(shots/f'{width}-family-access-{theme}.png'));page.locator('.member-access').get_by_role('button',name='Отмена',exact=True).click()
        print('PASS family features light/dark',width,height,flush=True)
    # Empty memories keep useful alternatives and no artificial header gap.
    empty=browser.new_context(viewport={'width':375,'height':812});assert empty.request.post(base+'/api/auth/register',data={'name':'Новый архив','email':'empty-'+str(time.time_ns())+'@example.test','password':'testing-password'}).ok
    ep=empty.new_page();ep.goto(base+'/memories');expect(ep.locator('.memory-empty')).to_be_visible();check(ep);assert ep.locator('.hero.page-heading').bounding_box()['height']<110;ep.screenshot(animations="disabled",path=str(shots/'empty-memories-mobile.png'),full_page=True)
    ep.goto(base+'/settings');expect(ep.get_by_role('button',name='Разрешить уведомления',exact=True)).to_be_visible()
    assert not empty.request.get(base+'/api/me').json()['settings']['desktopNotifications']
    empty.grant_permissions(['notifications']);expect(ep.get_by_role('switch',name='Уведомления браузера',exact=True)).to_have_attribute('aria-checked','false');ep.get_by_role('switch',name='Уведомления браузера',exact=True).click();expect(ep.get_by_role('switch',name='Уведомления браузера',exact=True)).to_have_attribute('aria-checked','true');ep.get_by_role('button',name='Сохранить изменения',exact=True).click();expect(ep.locator('.toast')).to_contain_text('Настройки сохранены');assert empty.request.get(base+'/api/me').json()['settings']['desktopNotifications']
    for width in [320,375,430,1280]:
        ep.set_viewport_size({'width':width,'height':812});ep.request.post(base+'/api/auth/logout');ep.goto(base);ep.get_by_role('button',name='Создать семейный архив',exact=True).click();check(ep)
        rects=ep.locator('.auth-actions button').evaluate_all('es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}})')
        assert rects[0]['right']<=rects[1]['x'] or rects[0]['bottom']<=rects[1]['y']
        ep.screenshot(animations="disabled",path=str(shots/f'{width}-registration.png'));close(ep)
    assert not errors,errors
    browser.close()
    print('PASS empty-state spacing, registration footer, seven mobile and two desktop sizes')
