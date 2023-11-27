# Generated by Django 3.2.16 on 2023-07-07 08:46

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('scrap_reasons', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='operation',
            options={'ordering': ['order']},
        ),
        migrations.AddField(
            model_name='operation',
            name='order',
            field=models.PositiveIntegerField(default=0, editable=False),
        ),
    ]
