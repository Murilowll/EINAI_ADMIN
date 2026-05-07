// Initialize EmailJS with your public key (already provided)
  emailjs.init("7AmMpwpBevGrBIubj");

  const form = document.getElementById('form');
  const submitBtn = document.getElementById('submitBtn');
  const btnLabel = document.getElementById('btnLabel');
  const btnSpinner = document.getElementById('btnSpinner');
  const statusEl = document.getElementById('status');

  function getCheckedValues(name){
    const inputs = Array.from(document.querySelectorAll('input[name="'+name+'"]'));
    return inputs.filter(i => i.checked).map(i => i.value);
  }

  function showLoading(on){
    if(on){
      btnSpinner.style.display = 'inline-block';
      btnLabel.textContent = 'Enviando...';
      submitBtn.disabled = true;
    } else {
      btnSpinner.style.display = 'none';
      btnLabel.textContent = 'Enviar respostas';
      submitBtn.disabled = false;
    }
  }

  function validateForm(){
    // basic validation: required text inputs + at least one checkbox per group
    const nome = document.getElementById('nome').value.trim();
    const nascimento = document.getElementById('nascimento').value;
    const telefone = document.getElementById('telefone').value.trim();
    const email = document.getElementById('email').value.trim();
    const motivos = getCheckedValues('motivo');
    const impedimentos = getCheckedValues('impedimento');

    if(!nome || !nascimento || !telefone || !email) return {ok:false, message: 'Preencha todos os campos pessoais.'};
    if(motivos.length === 0) return {ok:false, message: 'Selecione pelo menos uma razão para querer o curso.'};
    if(impedimentos.length === 0) return {ok:false, message: 'Selecione pelo menos um impedimento.'};

    // simple email pattern
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailPattern.test(email)) return {ok:false, message: 'Digite um e-mail válido.'};

    return {ok:true, data:{nome,nascimento,telefone,email,motivos,impedimentos}};
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    statusEl.textContent = '';
    const check = validateForm();
    if(!check.ok){
      statusEl.textContent = check.message;
      return;
    }

    const payload = {
      nome: check.data.nome,
      nascimento: check.data.nascimento,
      telefone: check.data.telefone,
      email: check.data.email,
      // joining arrays into comma separated strings so template receives readable text
      motivo: check.data.motivos.join(', '),
      impedimento: check.data.impedimentos.join(', ')
    };

    showLoading(true);

    // send using provided service and template IDs
    emailjs.send("service_3q3521j", "template_4xeaf8m", payload)
      .then(function(resp){
        showLoading(false);
        statusEl.textContent = 'Enviado com sucesso! Obrigado.';
        form.reset();
        // small success highlight
        setTimeout(()=> statusEl.textContent = '', 7000);
      }, function(err){
        showLoading(false);
        console.error('EmailJS error:', err);
        statusEl.textContent = 'Erro ao enviar. Tente novamente mais tarde.';
      });
  });

  // Optional: improve phone typing (basic formatting) — light mask
  const tel = document.getElementById('telefone');
  tel.addEventListener('input', function(e){
    let v = e.target.value.replace(/\D/g,'');
    if(v.length > 2) v = v.replace(/^(\d{2})(\d+)/g, ' $1 $2');
    if(v.length > 9) v = v.replace(/(\d{5})(\d{4})$/, '$1-$2'); // 9+ digits -> 99999-9999
    e.target.value = v.trim();
  });